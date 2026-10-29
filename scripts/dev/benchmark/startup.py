#!/usr/bin/env python3
"""Time Edge Studio start-up: `docker compose up -d` until the app and Minima answer.

Each iteration stops the whole Compose project, waits, starts it again and records:
  stop_s          `docker compose down` (Minima gets up to 60 s to shut down cleanly)
  up_cmd_s        `docker compose up -d` returning
  health_s        GET https://localhost:<port>/api/health answering {"status":"ok"}
  minima_rpc_s    Minima RPC `status` answering
  minima_synced_s Minima's chain tip being less than --synced-within seconds old

All times are seconds from the moment `up -d` was started. Run as root on the Pi.
Host helper services (systemd) are not restarted. Standard library only.
"""
import argparse
import csv
import json
import os
import ssl
import subprocess
import time
import urllib.request
from datetime import datetime, timezone


def compose_cmd(app_dir):
    cmd = ["docker", "compose", "--project-directory", app_dir]
    for name in ("docker-compose.yml", "docker-compose.release.yml", "docker-compose.override.yml"):
        if os.path.isfile(os.path.join(app_dir, name)):
            cmd += ["-f", os.path.join(app_dir, name)]
    return cmd


def env_value(app_dir, key, default):
    try:
        with open(os.path.join(app_dir, ".env")) as f:
            for line in f:
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip() or default
    except OSError:
        pass
    return default


def get_json(url, context=None):
    try:
        with urllib.request.urlopen(url, timeout=3, context=context) as res:
            return json.loads(res.read())
    except Exception:  # not up yet: refused, reset, TLS, 502 from nginx, partial JSON
        return None


def timed(cmd):
    started = time.monotonic()
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return time.monotonic() - started


def minima_tip_age(status):
    try:
        tip = datetime.strptime(status["response"]["chain"]["time"], "%a %b %d %H:%M:%S %Z %Y").replace(tzinfo=timezone.utc)
    except (KeyError, TypeError, ValueError):
        return None
    return (datetime.now(timezone.utc) - tip).total_seconds()


def iteration(args, compose, health_url, rpc_url, tls):
    result = {"stop_s": round(timed(compose + ["down"]), 1)}
    time.sleep(args.cooldown)

    started = time.monotonic()
    result["up_cmd_s"] = round(timed(compose + ["up", "-d"]), 1)
    pending = {"health_s", "minima_rpc_s", "minima_synced_s"}
    while pending and time.monotonic() - started < args.timeout:
        elapsed = round(time.monotonic() - started, 1)
        if "health_s" in pending and (get_json(health_url, tls) or {}).get("status") == "ok":
            result["health_s"] = elapsed
            pending.discard("health_s")
        if pending & {"minima_rpc_s", "minima_synced_s"}:
            status = get_json(rpc_url)
            if status and status.get("status"):
                if "minima_rpc_s" in pending:
                    result["minima_rpc_s"] = elapsed
                    pending.discard("minima_rpc_s")
                age = minima_tip_age(status)
                if age is not None and age < args.synced_within:
                    result["minima_synced_s"] = elapsed
                    pending.discard("minima_synced_s")
        time.sleep(0.5)
    for key in pending:
        result[key] = None
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", required=True, help="CSV file to write")
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--cooldown", type=float, default=30, help="seconds stopped before each start")
    parser.add_argument("--timeout", type=float, default=900, help="give up on an iteration after this many seconds")
    parser.add_argument("--synced-within", type=float, default=300, help="chain tip age that counts as synced (s)")
    parser.add_argument("--app-dir", default="/opt/edge-studio")
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("run as root (sudo)")

    compose = compose_cmd(args.app_dir)
    health_url = "https://localhost:{}/api/health".format(env_value(args.app_dir, "FRONTEND_PORT", "8080"))
    rpc_url = "http://127.0.0.1:{}/status".format(env_value(args.app_dir, "MINIMA_RPC_PORT", "9005"))
    tls = ssl.create_default_context()
    tls.check_hostname = False
    tls.verify_mode = ssl.CERT_NONE  # the app ships a self-signed certificate

    fields = ["iteration", "started_at", "stop_s", "up_cmd_s", "health_s", "minima_rpc_s", "minima_synced_s"]
    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, fields)
        writer.writeheader()
        for i in range(1, args.iterations + 1):
            started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            row = iteration(args, compose, health_url, rpc_url, tls)
            row.update({"iteration": i, "started_at": started_at})
            writer.writerow(row)
            f.flush()
            print(row, flush=True)


if __name__ == "__main__":
    main()
