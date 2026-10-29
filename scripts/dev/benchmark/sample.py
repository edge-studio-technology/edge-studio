#!/usr/bin/env python3
"""Sample Edge Studio resource use on the Pi, grouped by cgroup.

Each Compose service container, each Edge Studio host helper unit, and the Docker
engine is measured from its own cgroup, so every process in it is counted and nothing
else is. The sampler itself runs outside those cgroups and its own CPU and memory are
recorded separately and subtracted from the whole-system figures.

Run as root on the Pi (PSS and other users' /proc entries need it). Standard library only.

Writes into --out:
  samples.csv  per group: cpu_cores, pss_mb, read_kbs, write_kbs, procs
  system.csv   whole host: cpu_cores, mem_used_mb, swap_used_mb, temp_c, freq_mhz, load1
  disk.csv     sizes of the data/minima folders and the SQLite files
  meta.json    board, OS, app version, image sizes (start and end)
"""
import argparse
import csv
import json
import os
import platform
import signal
import subprocess
import time
from datetime import datetime, timezone

CGROUP_ROOT = "/sys/fs/cgroup"
HOST_UNITS = [
    "edge-studio-host-agent.service",
    "edge-studio-camera-helper.service",
    "edge-studio-sensor-helper.service",
]
ENGINE_UNITS = ["docker.service", "containerd.service"]
CLK_TCK = os.sysconf("SC_CLK_TCK")

stopping = False


def handle_stop(_signum, _frame):
    global stopping
    stopping = True


def read_file(path):
    try:
        with open(path) as f:
            return f.read()
    except OSError:
        return None


def iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")


# --- group discovery ---------------------------------------------------------

def compose_containers():
    """Map Compose service name -> cgroup dir for running containers."""
    try:
        out = subprocess.check_output(
            ["docker", "ps", "--no-trunc", "--format", '{{.ID}} {{.Label "com.docker.compose.service"}}'],
            text=True, stderr=subprocess.DEVNULL, timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return {}
    groups = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) != 2:
            continue
        cid, service = parts
        path = os.path.join(CGROUP_ROOT, "system.slice", "docker-{}.scope".format(cid))
        if os.path.isdir(path):
            groups[service] = path
    return groups


def unit_groups(units):
    groups = {}
    for unit in units:
        path = os.path.join(CGROUP_ROOT, "system.slice", unit)
        if os.path.isdir(path):
            groups[unit.replace(".service", "")] = path
    return groups


def discover():
    """Return {name: (kind, cgroup_path)}."""
    groups = {}
    for name, path in compose_containers().items():
        groups[name] = ("container", path)
    for name, path in unit_groups(HOST_UNITS).items():
        groups[name] = ("host", path)
    for name, path in unit_groups(ENGINE_UNITS).items():
        groups[name] = ("engine", path)
    return groups


# --- per-cgroup readers ------------------------------------------------------

def cgroup_pids(path):
    pids = []
    for root, _dirs, files in os.walk(path):
        if "cgroup.procs" in files:
            text = read_file(os.path.join(root, "cgroup.procs")) or ""
            pids.extend(int(p) for p in text.split())
    return pids


def cgroup_cpu_usec(path):
    text = read_file(os.path.join(path, "cpu.stat")) or ""
    for line in text.splitlines():
        if line.startswith("usage_usec "):
            return int(line.split()[1])
    return None


def cgroup_io_bytes(path):
    text = read_file(os.path.join(path, "io.stat")) or ""
    rbytes = wbytes = 0
    for line in text.splitlines():
        for field in line.split()[1:]:
            key, _, value = field.partition("=")
            if key == "rbytes":
                rbytes += int(value)
            elif key == "wbytes":
                wbytes += int(value)
    return rbytes, wbytes


def pss_kb(pid):
    text = read_file("/proc/{}/smaps_rollup".format(pid))
    if not text:
        return 0
    for line in text.splitlines():
        if line.startswith("Pss:"):
            return int(line.split()[1])
    return 0


def self_cpu_seconds():
    fields = (read_file("/proc/self/stat") or "").rsplit(")", 1)[-1].split()
    # utime and stime are fields 14 and 15; after stripping "pid (comm)" they are at 11 and 12.
    return (int(fields[11]) + int(fields[12])) / CLK_TCK


# --- system readers ----------------------------------------------------------

def proc_stat_busy():
    fields = [int(x) for x in (read_file("/proc/stat") or "").splitlines()[0].split()[1:]]
    idle = fields[3] + fields[4]
    return sum(fields) - idle, sum(fields)


def meminfo():
    values = {}
    for line in (read_file("/proc/meminfo") or "").splitlines():
        key, _, rest = line.partition(":")
        values[key] = int(rest.split()[0])
    return values


def temp_c():
    text = read_file("/sys/class/thermal/thermal_zone0/temp")
    return round(int(text) / 1000.0, 1) if text else None


def root_block_device():
    for line in (read_file("/proc/mounts") or "").splitlines():
        parts = line.split()
        if len(parts) > 1 and parts[1] == "/":
            return parts[0]
    return ""


def disk_sectors(device):
    """Sectors (512 B) read and written on the root filesystem's block device."""
    name = os.path.basename(device)
    for line in (read_file("/proc/diskstats") or "").splitlines():
        fields = line.split()
        if len(fields) > 9 and fields[2] == name:
            return int(fields[5]), int(fields[9])
    return 0, 0


def freq_mhz():
    text = read_file("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
    return int(text) // 1000 if text else None


# --- disk --------------------------------------------------------------------

def dir_bytes(path):
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.lstat(os.path.join(root, name)).st_blocks * 512
            except OSError:
                pass
    return total


def disk_targets(app_dir):
    return {
        "data": os.path.join(app_dir, "data"),
        "sqlite": os.path.join(app_dir, "data", "edge-studio.db"),
        "sqlite_wal": os.path.join(app_dir, "data", "edge-studio.db-wal"),
        "minima": os.path.join(app_dir, "minima"),
        "minima_backups": os.path.join(app_dir, "minima", "backups"),
    }


def disk_sizes(app_dir):
    sizes = {}
    for label, path in disk_targets(app_dir).items():
        if os.path.isdir(path):
            sizes[label] = dir_bytes(path)
        elif os.path.isfile(path):
            sizes[label] = os.lstat(path).st_blocks * 512
        else:
            sizes[label] = 0
    root = os.statvfs("/")
    sizes["root_fs_used"] = (root.f_blocks - root.f_bfree) * root.f_frsize
    return sizes


# --- meta --------------------------------------------------------------------

def docker_json(args):
    try:
        out = subprocess.check_output(["docker"] + args, text=True, stderr=subprocess.DEVNULL, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return []
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def image_sizes():
    """Per running container: image download (content) size and on-disk size as `docker image ls` reports it."""
    listed = {row.get("ID", ""): row.get("Size") for row in docker_json(["image", "ls", "--no-trunc", "--format", "{{json .}}"])}
    sizes = {}
    for row in docker_json(["ps", "--format", "{{json .}}"]):
        name = row.get("Names", "")
        try:
            image_id = subprocess.check_output(
                ["docker", "inspect", "-f", "{{.Image}}", name], text=True, stderr=subprocess.DEVNULL, timeout=15
            ).strip()
            content = subprocess.check_output(
                ["docker", "image", "inspect", "-f", "{{.Size}}", image_id], text=True, stderr=subprocess.DEVNULL, timeout=15
            ).strip()
        except (OSError, subprocess.SubprocessError):
            continue
        sizes[name] = {"image": row.get("Image", ""), "content_bytes": int(content), "disk_size": listed.get(image_id)}
    return sizes


def system_meta(app_dir):
    model = (read_file("/proc/device-tree/model") or "").strip("\x00\n")
    os_release = {}
    for line in (read_file("/etc/os-release") or "").splitlines():
        key, _, value = line.partition("=")
        os_release[key] = value.strip('"')
    manifest = read_file(os.path.join(app_dir, "update-agent-state", "last-applied-manifest.json"))
    return {
        "board": model,
        "os": os_release.get("PRETTY_NAME", ""),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "cpus": os.cpu_count(),
        "mem_total_mb": meminfo().get("MemTotal", 0) // 1024,
        "root_device": root_block_device(),
        "edge_studio_version": json.loads(manifest).get("version") if manifest else None,
    }


# --- main loop ---------------------------------------------------------------

def run(args):
    os.makedirs(args.out, exist_ok=True)
    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    meta = {"label": args.label, "started_at": iso(time.time()), "interval_s": args.interval}
    meta.update(system_meta(args.app_dir))
    meta["images_start"] = image_sizes()
    meta["docker_system_df_start"] = docker_json(["system", "df", "--format", "{{json .}}"])

    my_pid = os.getpid()
    groups = discover()
    last_discover = time.time()
    prev_cpu = {}
    prev_io = {}
    prev_busy, prev_total = proc_stat_busy()
    prev_self = self_cpu_seconds()
    root_dev = root_block_device()
    prev_sectors = disk_sectors(root_dev)
    prev_t = time.monotonic()
    started = time.time()
    next_disk = 0.0

    with open(os.path.join(args.out, "samples.csv"), "w", newline="") as sf, \
            open(os.path.join(args.out, "system.csv"), "w", newline="") as yf, \
            open(os.path.join(args.out, "disk.csv"), "w", newline="") as df:
        samples = csv.writer(sf)
        system = csv.writer(yf)
        disk = csv.writer(df)
        samples.writerow(["ts", "group", "kind", "cpu_cores", "pss_mb", "read_kbs", "write_kbs", "procs"])
        system.writerow(["ts", "cpu_cores", "mem_used_mb", "mem_available_mb", "swap_used_mb", "disk_read_kbs",
                         "disk_write_kbs", "temp_c", "freq_mhz", "load1", "monitor_cpu_cores", "monitor_pss_mb"])
        disk.writerow(["ts", "target", "bytes"])

        time.sleep(args.interval)
        while not stopping:
            now = time.time()
            if args.duration and now - started >= args.duration:
                break
            mono = time.monotonic()
            wall = max(mono - prev_t, 1e-6)
            prev_t = mono

            if now - last_discover >= args.rediscover:
                groups = discover()
                last_discover = now

            ts = iso(now)
            for name, (kind, path) in sorted(groups.items()):
                usec = cgroup_cpu_usec(path)
                if usec is None:
                    prev_cpu.pop(path, None)
                    continue
                cores = (usec - prev_cpu[path]) / 1e6 / wall if path in prev_cpu else None
                prev_cpu[path] = usec
                rb, wb = cgroup_io_bytes(path)
                if path in prev_io:
                    read_kbs = (rb - prev_io[path][0]) / 1024 / wall
                    write_kbs = (wb - prev_io[path][1]) / 1024 / wall
                else:
                    read_kbs = write_kbs = None
                prev_io[path] = (rb, wb)
                pids = [p for p in cgroup_pids(path) if p != my_pid]
                pss = sum(pss_kb(p) for p in pids) / 1024
                if cores is None:
                    continue
                samples.writerow([ts, name, kind, round(cores, 4), round(pss, 1), round(read_kbs, 1),
                                  round(write_kbs, 1), len(pids)])

            busy, total = proc_stat_busy()
            host_cores = (busy - prev_busy) / max(total - prev_total, 1) * os.cpu_count()
            prev_busy, prev_total = busy, total
            self_s = self_cpu_seconds()
            monitor_cores = (self_s - prev_self) / wall
            prev_self = self_s
            monitor_pss = pss_kb(my_pid) / 1024
            mem = meminfo()
            used_mb = (mem["MemTotal"] - mem["MemAvailable"]) / 1024
            swap_mb = (mem.get("SwapTotal", 0) - mem.get("SwapFree", 0)) / 1024
            load1 = (read_file("/proc/loadavg") or "0").split()[0]
            sectors = disk_sectors(root_dev)
            read_kbs = (sectors[0] - prev_sectors[0]) / 2 / wall
            write_kbs = (sectors[1] - prev_sectors[1]) / 2 / wall
            prev_sectors = sectors
            # Whole-host figures exclude the sampler itself (its disk writes go to the CSVs, which are tiny).
            system.writerow([ts, round(max(host_cores - monitor_cores, 0), 3), round(used_mb - monitor_pss, 1),
                             round(mem["MemAvailable"] / 1024, 1), round(swap_mb, 1), round(read_kbs, 1),
                             round(write_kbs, 1), temp_c(), freq_mhz(), load1, round(monitor_cores, 4),
                             round(monitor_pss, 1)])

            if now >= next_disk:
                for target, size in disk_sizes(args.app_dir).items():
                    disk.writerow([ts, target, size])
                df.flush()
                next_disk = now + args.disk_interval

            sf.flush()
            yf.flush()
            time.sleep(max(0.0, args.interval - (time.monotonic() - mono)))

        for target, size in disk_sizes(args.app_dir).items():
            disk.writerow([iso(time.time()), target, size])

    meta["ended_at"] = iso(time.time())
    meta["images_end"] = image_sizes()
    meta["docker_system_df_end"] = docker_json(["system", "df", "--format", "{{json .}}"])
    with open(os.path.join(args.out, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", required=True, help="output directory")
    parser.add_argument("--label", default="", help="free-text run label stored in meta.json")
    parser.add_argument("--interval", type=float, default=2.0, help="seconds between samples (default 2)")
    parser.add_argument("--duration", type=float, default=0, help="seconds to run; 0 = until Ctrl+C / SIGTERM")
    parser.add_argument("--disk-interval", type=float, default=300, help="seconds between disk size readings")
    parser.add_argument("--rediscover", type=float, default=10, help="seconds between container lookups")
    parser.add_argument("--app-dir", default="/opt/edge-studio")
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("run as root (sudo) so PSS and container processes are readable")
    run(args)


if __name__ == "__main__":
    main()
