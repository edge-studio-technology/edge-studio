# Edge Studio benchmark scripts

Measure the whole installed app bundle on a Pi: every Compose container, the host helper
services and the Docker engine. How to run them, the load profiles, and where the numbers go on
the wiki are in [docs/guides/pi-benchmark.md](../../../docs/guides/pi-benchmark.md).

| Script | Runs on | Does |
|---|---|---|
| `sample.py` | Pi, as root | CPU, PSS, temperature, disk I/O every 2 s, folder/image sizes every 5 min, into CSV |
| `startup.py` | Pi, as root | `compose down`/`up -d`, timed until `/api/health` is OK and Minima answers |
| `load.py` | Pi or laptop | Creates `bench-` workflows through the API, drives webhooks, collects run and proof timings, cleans up |
| `report.py` | Anywhere | Turns `sample.py` output into Markdown tables |

Adapted from the Minima student benchmark. Implementation notes:

- Processes are found by **cgroup** (one per container, one per systemd unit), not `pgrep`.
  The sampler never counts itself, and whole-Pi figures subtract its own CPU and memory.
- Memory is **PSS** summed over each cgroup's processes. Raspberry Pi OS boots with
  `cgroup_disable=memory`, so `docker stats` shows no memory there.
- Disk I/O is measured on the root block device. Without the memory cgroup, the kernel can't
  charge writes to a container.
- Start and stop go through `docker compose`, not Minima RPC.
- Python 3 standard library only.
