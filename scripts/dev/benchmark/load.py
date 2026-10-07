#!/usr/bin/env python3
"""Put an Edge Studio install under workflow load through its public API, and time it.

Runs from any machine that can reach the app (a laptop on the same network is best, so the
load generator does not compete with the Pi it is measuring). Standard library only.

Everything it creates is named with the "bench-" prefix, so `cleanup` can find it again.

  EDGE_STUDIO_PASSWORD=<pin> load.py --base https://<pi-ip>:8080 setup --profile typical
  load.py ... drive --duration 3600 --webhook-interval 10
  load.py ... probe --count 20
  load.py ... collect --since 2026-10-07T10:00:00Z --out results/02-typical
  load.py ... cleanup

Profiles (schedule workflows fetch Device System Data and stamp the hash with Integritas;
webhook workflows record the event, set a variable, check a condition and write an inbox preview):
  typical  5 schedule workflows every 60 s, 2 webhook workflows
  stress  10 schedule workflows every 15 s, 5 webhook workflows
"""
import argparse
import csv
import http.cookiejar
import json
import os
import ssl
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

PREFIX = "bench-"
PROFILES = {
    "typical": {"schedules": 5, "interval_s": 60, "webhooks": 2},
    "stress": {"schedules": 10, "interval_s": 15, "webhooks": 5},
}


class Api:
    def __init__(self, base, password):
        self.base = base.rstrip("/") + "/api"
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE  # the app ships a self-signed certificate
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=context), urllib.request.HTTPCookieProcessor(self.jar)
        )
        self.password = password

    def request(self, method, path, body=None, auth=True):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with self.opener.open(req, timeout=120) as res:
                raw = res.read()
                return res.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                return error.code, json.loads(raw)
            except ValueError:
                return error.code, raw.decode(errors="replace")

    def call(self, method, path, body=None):
        status, payload = self.request(method, path, body)
        if status >= 400:
            raise RuntimeError("{} {} -> {}: {}".format(method, path, status, str(payload)[:400]))
        return payload

    def login(self):
        self.call("POST", "/auth/login", {"password": self.password})


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_iso(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def bench_items(api, path):
    payload = api.call("GET", path)
    items = payload.get("items", payload) if isinstance(payload, dict) else payload
    return [item for item in items if str(item.get("name", "")).startswith(PREFIX)]


# --- setup -------------------------------------------------------------------

def create_source(api, name, type_, config):
    return api.call("POST", "/data-sources", {"name": name, "type": type_, "config": config})["item"]


def create_workflow(api, name, blocks):
    item = api.call("POST", "/automation/workflows", {"name": name, "enabled": True, "blocks": blocks})["item"]
    if not item["enabled"]:
        validation = api.call("GET", "/automation/workflows/{}/validation".format(item["id"]))
        raise RuntimeError("workflow {} saved but not enabled: {}".format(name, validation))
    return item


def schedule_blocks(source_id, interval_s):
    return [
        {"type": "schedule_start", "config": {"intervalSeconds": interval_s}},
        {"type": "fetch_data_source", "clientId": "fetch", "config": {"sourceId": source_id}},
        {"type": "stamp_integritas", "parentBlockId": "fetch", "config": {}},
        {"type": "set_variable", "config": {"variableName": "temp", "variableSource": "latest_data_field",
                                            "fieldPath": "performance.cpuTemperatureC"}},
        {"type": "show_preview", "config": {"title": "bench snapshot", "previewFormat": "json", "contentMode": "latest_data"}},
    ]


def webhook_blocks(source_id):
    return [
        {"type": "webhook_event_start", "config": {"sourceId": source_id}},
        {"type": "record_trigger_event", "config": {}},
        {"type": "set_variable", "config": {"variableName": "level", "variableSource": "trigger_field", "fieldPath": "level"}},
        {"type": "if_payload_field_equals", "config": {"source": "variable", "variableName": "level", "operator": "greater_than",
                                                       "value": 50}},
        {"type": "show_preview", "config": {"title": "bench webhook", "previewFormat": "json", "contentMode": "trigger_payload"}},
    ]


def cmd_setup(api, args):
    profile = PROFILES[args.profile]
    if bench_items(api, "/automation/workflows"):
        sys.exit("bench- workflows already exist; run cleanup first")
    system = create_source(api, PREFIX + "system", "device-system-data", {"includeLocation": False})
    for i in range(1, profile["schedules"] + 1):
        create_workflow(api, "{}poll-stamp-{}".format(PREFIX, i), schedule_blocks(system["id"], profile["interval_s"]))
    for i in range(1, profile["webhooks"] + 1):
        source = create_source(api, "{}webhook-{}".format(PREFIX, i), "webhook", {})
        create_workflow(api, "{}webhook-{}".format(PREFIX, i), webhook_blocks(source["id"]))
    probe = create_source(api, PREFIX + "probe", "device-system-data", {"includeLocation": False})
    api.call("POST", "/automation/workflows", {"name": PREFIX + "probe-stamp", "enabled": False, "blocks": [
        {"type": "manual_start", "config": {}},
        {"type": "fetch_data_source", "clientId": "fetch", "config": {"sourceId": probe["id"]}},
        {"type": "stamp_integritas", "parentBlockId": "fetch", "config": {}},
    ]})
    print("created profile {}: {}".format(args.profile, profile))


# --- drive webhooks ----------------------------------------------------------

def cmd_drive(api, args):
    sources = [s for s in bench_items(api, "/data-sources") if s["type"] == "webhook"]
    if not sources:
        sys.exit("no bench- webhook sources; run setup first")
    os.makedirs(args.out, exist_ok=True)
    out = open(os.path.join(args.out, "webhooks.csv"), "w", newline="")
    writer = csv.writer(out)
    writer.writerow(["ts", "source", "status", "latency_ms"])
    lock = threading.Lock()
    deadline = time.monotonic() + args.duration

    def worker(source):
        path = "/data-source-webhooks/" + source["config"]["webhookToken"]
        seq = 0
        while time.monotonic() < deadline:
            started = time.monotonic()
            seq += 1
            body = {"seq": seq, "level": seq % 100, "sentAt": now_iso(), "note": "edge studio benchmark"}
            status, _ = api.request("POST", path, body)
            latency = (time.monotonic() - started) * 1000
            with lock:
                writer.writerow([now_iso(), source["name"], status, round(latency, 1)])
            time.sleep(max(0.0, args.webhook_interval - (time.monotonic() - started)))

    threads = [threading.Thread(target=worker, args=(s,), daemon=True) for s in sources]
    for thread in threads:
        thread.start()
    print("driving {} webhook sources every {} s for {} s".format(len(sources), args.webhook_interval, args.duration))
    for thread in threads:
        thread.join()
    out.close()


# --- probe -------------------------------------------------------------------

def cmd_probe(api, args):
    probe = next((w for w in bench_items(api, "/automation/workflows") if w["name"] == PREFIX + "probe-stamp"), None)
    if not probe:
        sys.exit("no bench-probe-stamp workflow; run setup first")
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "probe.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        # Server-side run and block times for these runs come from `collect` (trigger "manual").
        writer.writerow(["ts", "status", "client_ms"])
        for _ in range(args.count):
            started = time.monotonic()
            status, _ = api.request("POST", "/automation/workflows/{}/run".format(probe["id"]), {})
            writer.writerow([now_iso(), status, round((time.monotonic() - started) * 1000, 1)])
            f.flush()
            time.sleep(max(0.0, args.spacing - (time.monotonic() - started)))


# --- collect -----------------------------------------------------------------

def paged(api, path, since):
    page = 1
    while True:
        payload = api.call("GET", "{}{}page={}&pageSize=100".format(path, "&" if "?" in path else "?", page))
        items = payload.get("items", [])
        for item in items:
            yield item
        oldest = items[-1] if items else None
        stamp = oldest and (oldest.get("startedAt") or oldest.get("created_at"))
        if not items or page >= payload.get("totalPages", page) or (stamp and parse_iso(stamp) < since):
            return
        page += 1


def pct(values, q):
    if not values:
        return None
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q / 100 * (len(values) - 1))))]


def summarize(label, values):
    if not values:
        return "{:<34} n=0".format(label)
    return "{:<34} n={:<6} median={:<8.0f} p95={:<8.0f} max={:.0f}".format(
        label, len(values), statistics.median(values), pct(values, 95), max(values))


def cmd_collect(api, args):
    since = parse_iso(args.since)
    until = parse_iso(args.until) if args.until else datetime.now(timezone.utc)
    os.makedirs(args.out, exist_ok=True)

    runs = [r for r in paged(api, "/automation/runs", since)
            if r["workflowName"].startswith(PREFIX) and since <= parse_iso(r["startedAt"]) <= until]
    with open(os.path.join(args.out, "runs.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["started_at", "workflow", "trigger", "status", "duration_ms", "error"])
        for r in runs:
            writer.writerow([r["startedAt"], r["workflowName"], r["triggerType"], r["status"], r["durationMs"], r.get("error") or ""])
    with open(os.path.join(args.out, "blocks.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["started_at", "workflow", "block_type", "status", "duration_ms"])
        for r in runs:
            for b in r.get("blocks", []):
                writer.writerow([b["startedAt"], r["workflowName"], b["blockType"], b["status"], b["durationMs"]])

    proofs = [p for p in paged(api, "/integritas/history", since)
              if since <= parse_iso(p["created_at"]) <= until and str(p.get("file_name", "")).startswith("Automation: " + PREFIX)]
    with open(os.path.join(args.out, "proofs.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["created_at", "updated_at", "status", "submit_to_ready_s"])
        for p in proofs:
            ready_s = None
            if p["proof_status"] == "ready":
                ready_s = (parse_iso(p["updated_at"]) - parse_iso(p["created_at"])).total_seconds()
            writer.writerow([p["created_at"], p["updated_at"], p["proof_status"], ready_s])

    hours = max((until - since).total_seconds() / 3600, 1e-9)
    lines = ["window {} .. {} ({:.2f} h)".format(since.isoformat(), until.isoformat(), hours)]
    by_status = {}
    for r in runs:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    lines.append("runs: {} ({:.0f}/h) by status {}".format(len(runs), len(runs) / hours, by_status))
    for trigger in sorted({r["triggerType"] for r in runs}):
        lines.append(summarize("run ms [{}]".format(trigger),
                               [r["durationMs"] for r in runs if r["triggerType"] == trigger and r["status"] == "success"]))
    block_times = {}
    for r in runs:
        for b in r.get("blocks", []):
            if b["status"] == "success" and b["durationMs"] is not None:
                block_times.setdefault(b["blockType"], []).append(b["durationMs"])
    for block_type in sorted(block_times):
        lines.append(summarize("block ms [{}]".format(block_type), block_times[block_type]))
    proof_status = {}
    for p in proofs:
        proof_status[p["proof_status"]] = proof_status.get(p["proof_status"], 0) + 1
    lines.append("proofs: {} by status {}".format(len(proofs), proof_status))
    lines.append(summarize("proof submit->ready s", [
        (parse_iso(p["updated_at"]) - parse_iso(p["created_at"])).total_seconds() for p in proofs if p["proof_status"] == "ready"]))
    errors = {}
    for r in runs:
        if r["status"] != "success":
            key = (r.get("error") or "")[:120]
            errors[key] = errors.get(key, 0) + 1
    for message, count in sorted(errors.items(), key=lambda kv: -kv[1])[:10]:
        lines.append("  {}x {}".format(count, message))
    text = "\n".join(lines)
    with open(os.path.join(args.out, "summary.txt"), "w") as f:
        f.write(text + "\n")
    print(text)


# --- cleanup -----------------------------------------------------------------

def cmd_cleanup(api, _args):
    for workflow in bench_items(api, "/automation/workflows"):
        api.call("DELETE", "/automation/workflows/" + workflow["id"])
        print("deleted workflow", workflow["name"])
    for source in bench_items(api, "/data-sources"):
        api.call("DELETE", "/data-sources/" + source["id"])
        print("deleted source", source["name"])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", required=True, help="app URL, e.g. https://192.168.1.20:8080")
    sub = parser.add_subparsers(dest="cmd", required=True)
    setup = sub.add_parser("setup")
    setup.add_argument("--profile", choices=sorted(PROFILES), required=True)
    drive = sub.add_parser("drive")
    drive.add_argument("--duration", type=float, required=True, help="seconds")
    drive.add_argument("--webhook-interval", type=float, default=10, help="seconds between posts per source (limit: 60/min)")
    drive.add_argument("--out", default=".")
    probe = sub.add_parser("probe")
    probe.add_argument("--count", type=int, default=20)
    probe.add_argument("--spacing", type=float, default=7, help="seconds between runs (manual runs: 30/min limit)")
    probe.add_argument("--out", default=".")
    collect = sub.add_parser("collect")
    collect.add_argument("--since", required=True, help="ISO time, UTC")
    collect.add_argument("--until", help="ISO time, UTC (default: now)")
    collect.add_argument("--out", default=".")
    sub.add_parser("cleanup")
    args = parser.parse_args()

    password = os.environ.get("EDGE_STUDIO_PASSWORD")
    if not password:
        parser.error("set EDGE_STUDIO_PASSWORD to the admin PIN/password")
    api = Api(args.base, password)
    api.login()
    {"setup": cmd_setup, "drive": cmd_drive, "probe": cmd_probe, "collect": cmd_collect, "cleanup": cmd_cleanup}[args.cmd](api, args)


if __name__ == "__main__":
    main()
