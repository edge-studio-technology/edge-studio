#!/usr/bin/env python3
"""Summarise one or more sample.py output directories as Markdown tables.

  report.py results/01-idle results/02-typical > report.md

CPU is in cores (1.00 = one core fully busy). Memory is PSS in MB, so shared pages are
split between the processes sharing them and the per-group figures add up.
"App total" is every Compose container plus the Edge Studio host helper units;
"Docker engine" (dockerd, containerd and the per-container shims) is shown separately.
Standard library only.
"""
import csv
import json
import os
import statistics
import sys
from collections import defaultdict
from datetime import datetime

APP_KINDS = {"container", "host"}


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q / 100 * (len(values) - 1))))]


def stats(values):
    return statistics.mean(values), pct(values, 95), max(values)


def read_csv(path):
    if not os.path.isfile(path):
        return []
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def human_bytes(n):
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024 or unit == "GB":
            return "{:.1f} {}".format(n, unit) if unit != "B" else "{} B".format(int(n))
        n /= 1024


def report(path):
    meta = {}
    if os.path.isfile(os.path.join(path, "meta.json")):
        with open(os.path.join(path, "meta.json")) as f:
            meta = json.load(f)
    samples = read_csv(os.path.join(path, "samples.csv"))
    system = read_csv(os.path.join(path, "system.csv"))
    disk = read_csv(os.path.join(path, "disk.csv"))
    out = ["## {}".format(meta.get("label") or os.path.basename(path.rstrip("/"))), ""]
    if meta:
        out.append("{} · {} · {} MB RAM · {} · Edge Studio {} · {} → {}".format(
            meta.get("board"), meta.get("os"), meta.get("mem_total_mb"), meta.get("root_device"),
            meta.get("edge_studio_version"), meta.get("started_at"), meta.get("ended_at", "running")))
        out.append("")

    cpu = defaultdict(list)
    pss = defaultdict(list)
    kinds = {}
    per_ts_cpu = defaultdict(lambda: defaultdict(float))
    per_ts_pss = defaultdict(lambda: defaultdict(float))
    for row in samples:
        group = row["group"]
        kinds[group] = row["kind"]
        c, p = float(row["cpu_cores"]), float(row["pss_mb"])
        cpu[group].append(c)
        pss[group].append(p)
        bucket = "app" if row["kind"] in APP_KINDS else "engine"
        per_ts_cpu[bucket][row["ts"]] += c
        per_ts_pss[bucket][row["ts"]] += p

    if samples:
        out.append("| Part | Kind | CPU cores mean / p95 / max | PSS MB mean / max |")
        out.append("|---|---|---|---|")
        order = sorted(cpu, key=lambda g: (kinds[g] not in APP_KINDS, kinds[g] != "container", g))
        for group in order:
            cm, cp, cx = stats(cpu[group])
            out.append("| {} | {} | {:.2f} / {:.2f} / {:.2f} | {:.0f} / {:.0f} |".format(
                group, kinds[group], cm, cp, cx, statistics.mean(pss[group]), max(pss[group])))
        for bucket, label in (("app", "**App total**"), ("engine", "**Docker engine**")):
            if per_ts_cpu[bucket]:
                cm, cp, cx = stats(list(per_ts_cpu[bucket].values()))
                pv = list(per_ts_pss[bucket].values())
                out.append("| {} | | {:.2f} / {:.2f} / {:.2f} | {:.0f} / {:.0f} |".format(label, cm, cp, cx, statistics.mean(pv), max(pv)))
        out.append("")

    if system:
        def col(name):
            return [float(r[name]) for r in system if r[name] not in ("", "None")]
        cm, cp, cx = stats(col("cpu_cores"))
        mm, mp, mx = stats(col("mem_used_mb"))
        out.append("| Whole Pi (sampler excluded) | mean | p95 | max |")
        out.append("|---|---|---|---|")
        out.append("| CPU cores busy | {:.2f} | {:.2f} | {:.2f} |".format(cm, cp, cx))
        out.append("| RAM used MB (total − available) | {:.0f} | {:.0f} | {:.0f} |".format(mm, mp, mx))
        out.append("| RAM available MB (min) | | | {:.0f} |".format(min(col("mem_available_mb"))))
        out.append("| Swap used MB | | | {:.0f} |".format(max(col("swap_used_mb"))))
        if "disk_write_kbs" in system[0]:
            out.append("| Disk read KB/s (root device) | {:.0f} | {:.0f} | {:.0f} |".format(*stats(col("disk_read_kbs"))))
            out.append("| Disk write KB/s (root device) | {:.0f} | {:.0f} | {:.0f} |".format(*stats(col("disk_write_kbs"))))
        temps = col("temp_c")
        if temps:
            out.append("| SoC temperature °C | {:.1f} | {:.1f} | {:.1f} |".format(*stats(temps)))
        monitor = col("monitor_cpu_cores")
        out.append("| Sampler itself: CPU cores / PSS MB | {:.3f} | | {:.0f} |".format(statistics.mean(monitor), max(col("monitor_pss_mb"))))
        out.append("")

    if disk:
        by_target = defaultdict(list)
        for row in disk:
            by_target[row["target"]].append((row["ts"], int(row["bytes"])))
        out.append("| Disk | start | end | growth | per hour |")
        out.append("|---|---|---|---|---|")
        for target, points in by_target.items():
            (t0, b0), (t1, b1) = points[0], points[-1]
            hours = (datetime.fromisoformat(t1) - datetime.fromisoformat(t0)).total_seconds() / 3600
            rate = human_bytes((b1 - b0) / hours) if hours > 0 else "n/a"
            out.append("| {} | {} | {} | {} | {} |".format(target, human_bytes(b0), human_bytes(b1), human_bytes(b1 - b0), rate))
        out.append("")

    images = meta.get("images_end") or meta.get("images_start") or {}
    if images:
        out.append("| Container | Image download | Image on disk |")
        out.append("|---|---|---|")
        for name, image in sorted(images.items()):
            out.append("| {} | {} | {} |".format(name, human_bytes(image.get("content_bytes", 0)), image.get("disk_size")))
        out.append("")
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print("\n".join(report(path) for path in sys.argv[1:]))


if __name__ == "__main__":
    main()
