# Edge Studio benchmark scripts

Measure the whole installed app bundle on a Pi: every Compose container, the host helper
services and the Docker engine. The results feed the wiki's *Hardware and Requirements* page.
Step-by-step guide, including device runs and where the numbers go on the wiki:
[docs/guides/pi-benchmark.md](../../../docs/guides/pi-benchmark.md).

Adapted from the Minima student benchmark (one 1-second `/proc` sampler, a runner, plots).
Changes from that version:

- Processes are found by **cgroup** (one per container, one per systemd unit), not `pgrep`.
  The sampler never counts itself, and whole-Pi figures subtract its own CPU and memory.
- Memory is **PSS** summed over each cgroup's processes. Raspberry Pi OS boots with
  `cgroup_disable=memory`, so `docker stats` shows no memory there.
- Disk I/O is measured on the root block device. Without the memory cgroup, the kernel can't
  charge writes to a container.
- Start and stop go through `docker compose`, not Minima RPC.
- Python 3 standard library only, on both the Pi and the laptop.

| Script | Runs on | Does |
|---|---|---|
| `sample.py` | Pi, as root | CPU, PSS, temperature, disk I/O, and folder/image sizes into CSV |
| `startup.py` | Pi, as root | `compose down`/`up -d`, timed until `/api/health` is OK and Minima answers and is synced |
| `load.py` | Laptop | Creates `bench-` workflows through the API, drives webhooks, times manual stamps, collects run and proof timings, cleans up |
| `report.py` | Anywhere | Turns `sample.py` output into Markdown tables |

## Run

```bash
# copy the scripts to the Pi
scp -r scripts/dev/benchmark pi@<pi-ip>:~/

# 1. idle (no workflows enabled), 1 h
ssh pi@<pi-ip> 'sudo nohup python3 ~/benchmark/sample.py --out ~/results/01-idle --label "Idle" --duration 3600 >/dev/null 2>&1 &'

# 2. start-up time (sampler running alongside catches the start-up peak)
ssh pi@<pi-ip> 'sudo python3 ~/benchmark/startup.py --out ~/results/startup.csv --iterations 5'

# 3. load: set up a profile, sample on the Pi, drive webhooks and probe from the laptop
export EDGE_STUDIO_PASSWORD=<admin pin>
B=https://<pi-ip>:8080
python3 scripts/dev/benchmark/load.py --base $B setup --profile typical
ssh pi@<pi-ip> 'sudo nohup python3 ~/benchmark/sample.py --out ~/results/02-typical --label "Typical load" --duration 3600 >/dev/null 2>&1 &'
python3 scripts/dev/benchmark/load.py --base $B drive --duration 3600 --webhook-interval 10 --out results/02-typical &
python3 scripts/dev/benchmark/load.py --base $B probe --count 20 --out results/02-typical
wait
python3 scripts/dev/benchmark/load.py --base $B collect --since <start, UTC ISO> --out results/02-typical
python3 scripts/dev/benchmark/load.py --base $B cleanup

# 4. report
scp -r pi@<pi-ip>:~/results/* results/
python3 scripts/dev/benchmark/report.py results/01-idle results/02-typical
```

Load profiles: schedule workflows fetch Device System Data, stamp the hash with Integritas,
set a variable and write an inbox preview. Webhook workflows record the event, set a
variable, check a condition and write an inbox preview.

| Profile | Schedule workflows | Webhook workflows |
|---|---|---|
| `typical` | 5, every 60 s | 2 (`drive --webhook-interval 10`) |
| `stress` | 10, every 15 s | 5 (`drive --webhook-interval 1.1`) |

## Limits to keep in mind

- Webhooks: 60 requests per minute per source per client IP. Manual runs: 30 per minute.
  Each workflow can reach side-effect blocks (stamping) 1,000 times per rolling hour.
- No Minima funds are spent: the profiles have no wallet blocks.
- Stamps use real Integritas credits from the connected account.
- `cleanup` deletes the `bench-` workflows and sources. Their run history, inbox items and
  Integritas history stay in the database, so measured database growth stays on disk.
- Don't `pkill -f sample.py` over SSH: the pattern also matches the SSH shell running the
  command. Send SIGTERM to the PID instead; the sampler flushes and writes `meta.json` on exit.
