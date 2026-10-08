# Benchmarking Edge Studio on a Pi

How to measure Edge Studio on a Raspberry Pi with the scripts in [`scripts/dev/benchmark/`](../../scripts/dev/benchmark/README.md), and how to turn the results into the wiki's *Hardware and Requirements* page.

Already measured: Pi 5, 4 GB, microSD, 64-bit Raspberry Pi OS, v0.42.2. Results, findings and known gaps are in the comments on OpenProject #619. The most useful next measurements are:

- **Other boards:** Pi 4, Pi 3, Zero 2 W, 2 GB boards. These fill the board table and the CPU minimum.
- **32-bit (armv7) Raspberry Pi OS.**
- **Devices:** BME280/BME680, GPIO, camera, MQTT. The load profiles don't cover these yet.

## What the scripts do

| Script | Runs on | Does |
|---|---|---|
| `sample.py` | Pi, as root | Every 2 s, records CPU and memory for each container, Edge Studio host service (host agent, camera and sensor helpers) and the Docker engine, plus whole-Pi RAM, temperature and disk I/O. Records folder and image sizes every 5 min. |
| `startup.py` | Pi, as root | Stops and starts the app with `docker compose`. Times how long until the web app is healthy and Minima answers. |
| `load.py` | Pi or laptop | Creates `bench-` workflows through the API, drives webhooks, collects run and proof timings, and cleans up. |
| `report.py` | Anywhere | Turns a `sample.py` folder into Markdown tables. |

All four use the Python 3 standard library only. There's nothing to install.

Two measurement rules:

- **Memory is PSS read from `/proc`, not `docker stats`.** Raspberry Pi OS boots with `cgroup_disable=memory`, so `docker stats` shows 0 MB.
- **The sampler doesn't count its own usage.** It reports itself as a separate line.

## Before you start

- Install the **prod release** with `install.sh` from `main`, not a dev build. That's what the wiki describes.
- Wait until **Minima is synced** (Minima page shows a recent block).
- Make sure **Integritas is connected**. Stamps use real credits from the connected account.
- Keep the app's admin PIN/password at hand. `load.py` reads it from `EDGE_STUDIO_PASSWORD`.
- Copy the scripts to the Pi:

  ```bash
  scp -r scripts/dev/benchmark <user>@<pi-ip>:~/
  ```

Run everything **on the Pi** with `--base https://localhost:8080`. Long runs then keep going if your laptop sleeps, and webhook timings don't include Wi-Fi.

Use `nohup` for anything longer than a few minutes, so closing SSH doesn't stop it.

## Runs, in order

Use one results folder per run. Each run is 1 hour unless noted.

### 1. Idle

Turn off all workflows first.

```bash
sudo nohup python3 ~/benchmark/sample.py --out ~/results/01-idle --label "Idle, Pi 4 4 GB" --duration 3600 >/dev/null 2>&1 &
```

### 2. Start-up time

Takes about 10 minutes. Run a sampler alongside it to catch the start-up CPU peak.

```bash
sudo nohup python3 ~/benchmark/sample.py --out ~/results/02-startup --label "Start-up" --duration 900 >/dev/null 2>&1 &
sudo python3 ~/benchmark/startup.py --out ~/results/startup.csv --iterations 5
```

For reboot time, reboot by hand and note how long until the web page loads.

### 3. Typical load

5 workflows fetch Device System Data and stamp it every 60 s. 2 webhook sources post every 10 s.

```bash
export EDGE_STUDIO_PASSWORD=<admin pin>
L="python3 $HOME/benchmark/load.py --base https://localhost:8080"
$L setup --profile typical
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sudo nohup python3 ~/benchmark/sample.py --out ~/results/03-typical --label "Typical load" --duration 3600 >/dev/null 2>&1 &
$L drive --duration 3600 --webhook-interval 10 --out ~/results/03-typical-load
$L collect --since $START --out ~/results/03-typical-load
$L cleanup
```

`collect` writes `summary.txt` with run counts, failures, run and block times, and how long proofs take to become ready.

### 4. Stress (optional)

Same as typical, with `--profile stress` and `--webhook-interval 1.1`. That's 10 workflows every 15 s and 5 webhooks about once a second, around 18,000 runs an hour. Skip it on small boards if the Pi becomes unusable, and write that down; it's a result too.

### 5. Devices: sensors, GPIO, camera, MQTT

`load.py` doesn't create device workflows. Build them in the UI instead:

- Name every source and workflow with a **`bench-` prefix**, for example `bench-bme280` and `bench-bme-stamp`. `collect` then includes them and `cleanup` removes them.
- Use the same shape as typical: Schedule every 60 s → Fetch (the sensor source) → Stamp, then Show preview. Use 5 workflows if the device allows it.
- For GPIO or MQTT, trigger events at a steady rate (button presses, or an ESP32 publishing every 10 s).

Then run the sampler, `collect` and `cleanup` as in step 3, without `setup` and `drive`. The camera and sensor helper services show up in the report on their own once enabled.

### 6. Overnight soak (optional)

Use a 12 h typical run to measure Minima disk growth per week and to check memory stays flat. Put the step-3 commands in a script with `--duration 43200`, and end it with `collect --since $START --until $END` and `cleanup`. Start it with `sudo nohup bash ~/run-soak.sh &`. Delete the script afterwards: it holds the password.

## Make the report

Copy the results back and build the tables:

```bash
scp -r <user>@<pi-ip>:results ./results
python3 scripts/dev/benchmark/report.py results/01-idle results/03-typical > report.md
```

Where the report numbers go on the wiki page:

| Report line | Wiki cell |
|---|---|
| Per-container PSS **max** (rounded up) | Memory per service, RAM column |
| Per-container CPU **mean** | Memory per service, CPU column |
| **App total**, **Docker engine**, Whole Pi RAM used max / CPU mean | Total rows |
| Disk table: `sqlite` growth per hour vs. runs from `summary.txt` | Database growth per 1,000 runs |
| Disk table: `minima` growth per hour × 168 | Minima growth per week (soak only) |
| `startup.csv` `health_s` / `minima_rpc_s` | Start-up time |

Then:

- Mark each cell you filled as Measured.
- Add a row to the measurement log comment at the top of the wiki page: date, board/RAM, storage, OS, version, what ran.
- Post the `summary.txt` and report tables as a comment on the ticket.

## Things that bite

- **Don't `pkill -f sample.py` over SSH.** The pattern matches your own SSH command and kills the session. Use `sudo kill <pid>`; the sampler then saves its files.
- **Rate limits:**
  - Webhooks: 60 per minute per source.
  - Manual runs: 30 per minute.
  - Each workflow: 1,000 stamping runs per rolling hour.
- **Cleanup:** `cleanup` turns workflows off and waits 30 s before deleting them. If you delete a workflow by hand while it's still running, the run fails with a `FOREIGN KEY` error.
- **The database keeps growing.** Run history isn't deleted, so the typical profile adds about 265 MB a day. Check free space before long runs, and when you're done, use `scripts/dev/clear-db.sh` with `TARGET=history`.
- **Integritas returns HTTP 502 now and then** when several workflows stamp in the same second. A few failures per run are expected; note how many.
- **v0.42.2 numbers include the Minima busy loop**, about 1 core of CPU even at idle. If a later release fixes it, note the version so results stay comparable.
