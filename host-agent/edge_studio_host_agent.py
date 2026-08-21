#!/usr/bin/env python3
import json
import os
import secrets
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


APP_DIR = Path(os.environ.get("APP_DIR", "/opt/edge-studio"))
ENV_FILE = APP_DIR / ".env"
HOST = os.environ.get("HOST_AGENT_HOST", "0.0.0.0")
PORT = int(os.environ.get("HOST_AGENT_PORT", "38182"))
TOKEN = os.environ.get("HOST_AGENT_TOKEN", "")
HOST_CAPABILITY_DEBUG = os.environ.get("HOST_CAPABILITY_DEBUG", "false")
CAMERA_SERVICE_FILE = Path("/etc/systemd/system/edge-studio-camera-helper.service")
SENSOR_SERVICE_FILE = Path("/etc/systemd/system/edge-studio-sensor-helper.service")
COMPOSE_OVERRIDE_FILE = APP_DIR / "docker-compose.override.yml"
GPIO_OVERRIDE_MARKER = "# Managed by Edge Studio host-agent for GPIO support."


def read_env():
    values = {}
    if not ENV_FILE.exists():
        return values
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def write_env(updates):
    lines = []
    seen = set()
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line and not line.startswith("#") and "=" in line:
                key = line.split("=", 1)[0]
                if key in updates:
                    lines.append(f"{key}={updates[key]}")
                    seen.add(key)
                    continue
            lines.append(line)
    for key, value in updates.items():
        if key not in seen:
            lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    os.chmod(ENV_FILE, 0o600)


def update_compose_profiles(config, profile, enabled):
    profiles = [item for item in config.get("COMPOSE_PROFILES", "").split(",") if item]
    if enabled and profile not in profiles:
        profiles.append(profile)
    if not enabled:
        profiles = [item for item in profiles if item != profile]
    return ",".join(profiles)


def is_truthy(value):
    return str(value or "").lower() in {"1", "true", "yes", "on"}


def debug_enabled(config=None):
    if is_truthy(HOST_CAPABILITY_DEBUG):
        return True
    return is_truthy((config or read_env()).get("HOST_CAPABILITY_DEBUG"))


def debug_log(message, details=None, config=None):
    if not debug_enabled(config):
        return
    suffix = f" {json.dumps(details, sort_keys=True)}" if details is not None else ""
    print(f"[host-agent] {message}{suffix}", flush=True)


def resolved_data_dir(config):
    value = config.get("DATA_DIR", "./data")
    return Path(value) if value.startswith("/") else APP_DIR / value.removeprefix("./")


def resolved_camera_capture_dir(config):
    value = config.get("CAMERA_CAPTURE_DIR", "/data/captures")
    if value.startswith("/data/"):
        return resolved_data_dir(config) / value.removeprefix("/data/")
    if value.startswith("/"):
        return Path(value)
    return APP_DIR / value.removeprefix("./")


def run(command, check=True):
    completed = subprocess.run(command, cwd=str(APP_DIR), text=True, capture_output=True, check=False)
    if check and completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or f"exit code {completed.returncode}"
        raise RuntimeError(detail)
    return completed


def compose_args(config):
    args = ["docker", "compose", "-f", "docker-compose.yml"]
    if not is_truthy(config.get("DEV_MODE", "false")) and (APP_DIR / "docker-compose.release.yml").exists():
        args.extend(["-f", "docker-compose.release.yml"])
    if (APP_DIR / "docker-compose.override.yml").exists():
        args.extend(["-f", "docker-compose.override.yml"])
    return args


def restart_backend(config):
    if not shutil.which("docker"):
        return {"ok": False, "message": "docker was not found on the host"}
    command = " ".join(compose_args(config) + ["up", "-d", "--no-deps", "backend"])
    debug_log("schedule backend restart", {"command": command}, config)
    subprocess.Popen(["/bin/sh", "-c", f"sleep 1; {command}"], cwd=str(APP_DIR))
    return {"ok": True, "scheduled": True}


def schedule_compose(config, args):
    if not shutil.which("docker"):
        return {"ok": False, "message": "docker was not found on the host"}
    command = " ".join(compose_args(config) + args)
    debug_log("schedule compose command", {"command": command}, config)
    subprocess.Popen(["/bin/sh", "-c", f"sleep 1; {command}"], cwd=str(APP_DIR))
    return {"ok": True, "scheduled": True}


def ensure_camera_token(config):
    token = config.get("CAMERA_HELPER_TOKEN", "")
    if token:
        return token
    return secrets.token_hex(32)


def ensure_sensor_token(config):
    token = config.get("SENSOR_HELPER_TOKEN", "")
    if token:
        return token
    return secrets.token_hex(32)


def missing_camera_tools_message():
    if shutil.which("rpicam-still") or shutil.which("libcamera-still"):
        return None
    return "Neither rpicam-still nor libcamera-still was found on the host. Install or enable the Raspberry Pi camera stack on the host, then refresh Hardware support."


def missing_sensor_prerequisites_message():
    if not shutil.which("python3"):
        return "python3 was not found on the host. Install Python 3 before enabling I2C sensor support."
    if not Path("/dev/i2c-1").exists():
        return "/dev/i2c-1 was not found on the host. Enable I2C on the Raspberry Pi host, then refresh Hardware support."
    completed = run(["python3", "-c", "try:\n import smbus2\nexcept Exception:\n import smbus"], check=False)
    if completed.returncode != 0:
        return "Python SMBus support was not found. Install python3-smbus or python3-smbus2 on the host before enabling I2C sensor support."
    return None


def helper_user():
    configured = os.environ.get("HOST_HELPER_USER", os.environ.get("SUDO_USER", "pi"))
    try:
        run(["id", configured])
        return configured
    except Exception:
        return "root"


def camera_status():
    config = read_env()
    service_exists = CAMERA_SERVICE_FILE.exists()
    service_active = run(["systemctl", "is-active", "edge-studio-camera-helper.service"], check=False).stdout.strip() == "active" if shutil.which("systemctl") else False
    enabled = is_truthy(config.get("ENABLE_CAMERA"))
    missing_tools = missing_camera_tools_message()
    available = enabled and service_exists and service_active and missing_tools is None
    reason = None
    state = "enabled" if available else "disabled" if not enabled else "failed"
    if missing_tools:
        reason = missing_tools
        state = "missing_prerequisites"
    elif not enabled:
        reason = "Camera support is disabled."
    elif not service_exists:
        reason = "Camera helper service is not installed."
    elif not service_active:
        reason = "Camera helper service is not active."
    return {
        "name": "camera",
        "enabled": enabled,
        "installed": service_exists,
        "available": available,
        "state": state,
        "reason": reason,
        "captureDir": config.get("CAMERA_CAPTURE_DIR", "/data/captures"),
        "helperPort": int(config.get("CAMERA_HELPER_PORT", "38180")),
    }


def detect_gpio_gid():
    if Path("/dev/gpiochip0").exists():
        return str(Path("/dev/gpiochip0").stat().st_gid)
    completed = run(["getent", "group", "gpio"], check=False)
    if completed.returncode == 0 and completed.stdout.strip():
        parts = completed.stdout.strip().split(":")
        if len(parts) > 2:
            return parts[2]
    return "0"


def write_gpio_override(config):
    if not is_truthy(config.get("ENABLE_GPIO")):
        if is_managed_gpio_override():
            COMPOSE_OVERRIDE_FILE.unlink()
        return

    docker_gid = config.get("DOCKER_GID", "0")
    gpio_gid = config.get("GPIO_GID", "0")
    lines = [GPIO_OVERRIDE_MARKER, "services:", "  backend:", "    devices:", "      - /dev/gpiochip0:/dev/gpiochip0"]
    if gpio_gid != docker_gid:
        lines.extend(["    group_add:", "      - \"${GPIO_GID:-0}\""])
    COMPOSE_OVERRIDE_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def is_managed_gpio_override():
    if not COMPOSE_OVERRIDE_FILE.exists():
        return False
    content = COMPOSE_OVERRIDE_FILE.read_text(encoding="utf-8")
    if content.startswith(GPIO_OVERRIDE_MARKER):
        return True
    installer_without_group = "services:\n  backend:\n    devices:\n      - /dev/gpiochip0:/dev/gpiochip0\n"
    installer_with_group = installer_without_group + "    group_add:\n      - \"${GPIO_GID:-0}\"\n"
    return content in {installer_without_group, installer_with_group}


def gpio_status():
    config = read_env()
    enabled = is_truthy(config.get("ENABLE_GPIO"))
    device_exists = Path("/dev/gpiochip0").exists()
    override_exists = COMPOSE_OVERRIDE_FILE.exists()
    available = enabled and device_exists and override_exists
    state = "enabled" if available else "disabled" if not enabled else "missing_prerequisites" if not device_exists else "failed"
    reason = None
    if not device_exists:
        reason = "/dev/gpiochip0 was not found on the host. GPIO support requires Raspberry Pi GPIO support to be present."
    elif not enabled:
        reason = "GPIO support is disabled."
    elif not override_exists:
        reason = "GPIO Compose device access is not configured."
    return {
        "name": "gpio",
        "enabled": enabled,
        "installed": override_exists,
        "available": available,
        "state": state,
        "reason": reason,
        "devicePath": "/dev/gpiochip0",
    }


def apply_gpio():
    debug_log("apply gpio requested")
    status = gpio_status()
    if status["state"] == "missing_prerequisites":
        raise ValueError(status["reason"])
    config = read_env()
    gpio_gid = config.get("GPIO_GID") or detect_gpio_gid()
    write_env({"ENABLE_GPIO": "true", "GPIO_GID": gpio_gid})
    updated = read_env()
    write_gpio_override(updated)
    restart = restart_backend(updated)
    debug_log("apply gpio completed", {"capability": gpio_status(), "restart": restart}, updated)
    return {"capability": gpio_status(), "restart": restart}


def disable_gpio():
    debug_log("disable gpio requested")
    write_env({"ENABLE_GPIO": "false"})
    config = read_env()
    write_gpio_override(config)
    restart = restart_backend(config)
    debug_log("disable gpio completed", {"capability": gpio_status(), "restart": restart}, config)
    return {"capability": gpio_status(), "restart": restart}


def sensor_status():
    config = read_env()
    enabled = is_truthy(config.get("ENABLE_SENSORS"))
    service_exists = SENSOR_SERVICE_FILE.exists()
    service_active = run(["systemctl", "is-active", "edge-studio-sensor-helper.service"], check=False).stdout.strip() == "active" if shutil.which("systemctl") else False
    i2c_exists = Path("/dev/i2c-1").exists()
    available = enabled and service_exists and service_active and i2c_exists
    state = "enabled" if available else "disabled" if not enabled else "missing_prerequisites" if not i2c_exists else "failed"
    reason = None
    if not i2c_exists:
        reason = "/dev/i2c-1 was not found on the host. Enable I2C on the Raspberry Pi host, then refresh Hardware support."
    elif not enabled:
        reason = "I2C sensor support is disabled."
    elif not service_exists:
        reason = "Sensor helper service is not installed."
    elif not service_active:
        reason = "Sensor helper service is not active."
    return {
        "name": "sensors",
        "enabled": enabled,
        "installed": service_exists,
        "available": available,
        "state": state,
        "reason": reason,
        "devicePath": "/dev/i2c-1",
    }


def apply_sensors():
    debug_log("apply sensors requested")
    missing = missing_sensor_prerequisites_message()
    if missing:
        raise ValueError(missing)

    config = read_env()
    token = ensure_sensor_token(config)
    port = config.get("SENSOR_HELPER_PORT", "38181")
    sensor_venv = APP_DIR / ".venv-sensor-helper"
    sensor_python = sensor_venv / "bin" / "python"
    if not sensor_python.exists():
        run(["python3", "-m", "venv", "--system-site-packages", str(sensor_venv)])
    run([str(sensor_python), "-m", "pip", "install", "bme680"], check=False)

    user = helper_user()
    supplementary_groups = "SupplementaryGroups=i2c" if run(["getent", "group", "i2c"], check=False).returncode == 0 else ""
    service = f"""[Unit]
Description=Edge Studio Sensor Helper
After=network.target

[Service]
Type=simple
User={user}
{supplementary_groups}
WorkingDirectory={APP_DIR}
Environment=SENSOR_HELPER_HOST=0.0.0.0
Environment=SENSOR_HELPER_PORT={port}
Environment=SENSOR_HELPER_TOKEN={token}
Environment=INTEGRITAS_DOCKER_SUBNET={config.get('INTEGRITAS_DOCKER_SUBNET', '172.30.0.0/24')}
Environment=INTEGRITAS_DOCKER_GATEWAY={config.get('INTEGRITAS_DOCKER_GATEWAY', '172.30.0.1')}
ExecStartPre=+/bin/sh -c 'if command -v iptables >/dev/null 2>&1; then iptables -C INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $SENSOR_HELPER_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $SENSOR_HELPER_PORT -j ACCEPT; fi'
ExecStart={sensor_python} {APP_DIR}/sensor-helper/edge_studio_sensor_helper.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
"""
    SENSOR_SERVICE_FILE.write_text(service, encoding="utf-8")
    os.chmod(SENSOR_SERVICE_FILE, 0o600)
    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", "edge-studio-sensor-helper.service"])
    run(["systemctl", "restart", "edge-studio-sensor-helper.service"])

    gateway = config.get("INTEGRITAS_DOCKER_GATEWAY", "172.30.0.1")
    write_env({
        "ENABLE_SENSORS": "true",
        "SENSOR_HELPER_URL": f"http://{gateway}:{port}",
        "SENSOR_HELPER_TOKEN": token,
        "SENSOR_HELPER_PORT": port,
    })
    updated = read_env()
    restart = restart_backend(updated)
    debug_log("apply sensors completed", {"capability": sensor_status(), "restart": restart}, updated)
    return {"capability": sensor_status(), "restart": restart}


def disable_sensors():
    debug_log("disable sensors requested")
    if shutil.which("systemctl"):
        run(["systemctl", "disable", "--now", "edge-studio-sensor-helper.service"], check=False)
        if SENSOR_SERVICE_FILE.exists():
            SENSOR_SERVICE_FILE.unlink()
        run(["systemctl", "daemon-reload"], check=False)
    write_env({"ENABLE_SENSORS": "false"})
    config = read_env()
    restart = restart_backend(config)
    debug_log("disable sensors completed", {"capability": sensor_status(), "restart": restart}, config)
    return {"capability": sensor_status(), "restart": restart}


def mqtt_status():
    config = read_env()
    enabled = is_truthy(config.get("ENABLE_MQTT_BROKER"))
    profiles = [item for item in config.get("COMPOSE_PROFILES", "").split(",") if item]
    profile_enabled = "mqtt" in profiles
    available = enabled and profile_enabled
    reason = None
    if not enabled:
        reason = "Local MQTT broker is disabled."
    elif not profile_enabled:
        reason = "Docker Compose mqtt profile is not enabled."
    return {
        "name": "mqtt",
        "enabled": enabled,
        "installed": profile_enabled,
        "available": available,
        "state": "enabled" if available else "disabled" if not enabled else "failed",
        "reason": reason,
        "publicPort": int(config.get("MQTT_PUBLIC_PORT", "1883")),
        "internalUrl": config.get("MQTT_INTERNAL_URL", "mqtt://mqtt:1883"),
    }


def apply_mqtt():
    debug_log("apply mqtt requested")
    config = read_env()
    profiles = update_compose_profiles(config, "mqtt", True)
    write_env({"ENABLE_MQTT_BROKER": "true", "COMPOSE_PROFILES": profiles, "MQTT_INTERNAL_URL": "mqtt://mqtt:1883"})
    updated = read_env()
    restart = schedule_compose(updated, ["up", "-d", "mqtt", "backend"])
    debug_log("apply mqtt completed", {"capability": mqtt_status(), "restart": restart}, updated)
    return {"capability": mqtt_status(), "restart": restart}


def disable_mqtt():
    debug_log("disable mqtt requested")
    config = read_env()
    profiles = update_compose_profiles(config, "mqtt", False)
    write_env({"ENABLE_MQTT_BROKER": "false", "COMPOSE_PROFILES": profiles})
    updated = read_env()
    restart = schedule_compose(updated, ["stop", "mqtt"])
    backend_restart = restart_backend(updated)
    debug_log("disable mqtt completed", {"capability": mqtt_status(), "restart": backend_restart, "service": restart}, updated)
    return {"capability": mqtt_status(), "restart": backend_restart, "service": restart}


def all_capabilities():
    return [camera_status(), gpio_status(), sensor_status(), mqtt_status()]


def apply_camera():
    debug_log("apply camera requested")
    missing_tools = missing_camera_tools_message()
    if missing_tools:
        raise ValueError(missing_tools)

    config = read_env()
    token = ensure_camera_token(config)
    port = config.get("CAMERA_HELPER_PORT", "38180")
    capture_dir_container = config.get("CAMERA_CAPTURE_DIR", "/data/captures")
    capture_dir = resolved_camera_capture_dir({**config, "CAMERA_CAPTURE_DIR": capture_dir_container})
    capture_dir.mkdir(parents=True, exist_ok=True)
    user = helper_user()
    if user != "root":
        run(["chown", "-R", f"{user}:{user}", str(capture_dir)])
    os.chmod(capture_dir, 0o700)

    supplementary_groups = "SupplementaryGroups=video" if run(["getent", "group", "video"], check=False).returncode == 0 else ""
    service = f"""[Unit]
Description=Edge Studio Camera Helper
After=network.target

[Service]
Type=simple
User={user}
{supplementary_groups}
WorkingDirectory={APP_DIR}
Environment=CAMERA_HELPER_HOST=0.0.0.0
Environment=CAMERA_HELPER_PORT={port}
Environment=CAMERA_HELPER_TOKEN={token}
Environment=CAMERA_CAPTURE_DIR={capture_dir}
Environment=CAMERA_CONTAINER_CAPTURE_DIR={capture_dir_container}
Environment=CAMERA_MAX_DURATION_SECONDS={config.get('CAMERA_MAX_DURATION_SECONDS', '30')}
Environment=CAMERA_PHOTO_COMMAND={config.get('CAMERA_PHOTO_COMMAND', 'rpicam-still')}
Environment=CAMERA_VIDEO_COMMAND={config.get('CAMERA_VIDEO_COMMAND', 'rpicam-vid')}
Environment=INTEGRITAS_DOCKER_SUBNET={config.get('INTEGRITAS_DOCKER_SUBNET', '172.30.0.0/24')}
Environment=INTEGRITAS_DOCKER_GATEWAY={config.get('INTEGRITAS_DOCKER_GATEWAY', '172.30.0.1')}
ExecStartPre=+/bin/sh -c 'if command -v iptables >/dev/null 2>&1; then iptables -C INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $CAMERA_HELPER_PORT -j ACCEPT 2>/dev/null || iptables -I INPUT -s $INTEGRITAS_DOCKER_SUBNET -p tcp --dport $CAMERA_HELPER_PORT -j ACCEPT; fi'
ExecStart=/usr/bin/python3 {APP_DIR}/camera-helper/edge_studio_camera_helper.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
"""
    CAMERA_SERVICE_FILE.write_text(service, encoding="utf-8")
    os.chmod(CAMERA_SERVICE_FILE, 0o600)
    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", "edge-studio-camera-helper.service"])
    run(["systemctl", "restart", "edge-studio-camera-helper.service"])

    gateway = config.get("INTEGRITAS_DOCKER_GATEWAY", "172.30.0.1")
    write_env({
        "ENABLE_CAMERA": "true",
        "CAMERA_CAPTURE_DIR": capture_dir_container,
        "CAMERA_HELPER_URL": f"http://{gateway}:{port}",
        "CAMERA_HELPER_TOKEN": token,
        "CAMERA_HELPER_PORT": port,
    })
    updated = read_env()
    restart = restart_backend(updated)
    debug_log("apply camera completed", {"capability": camera_status(), "restart": restart}, updated)
    return {"capability": camera_status(), "restart": restart, "warning": None}


def disable_camera():
    debug_log("disable camera requested")
    if shutil.which("systemctl"):
        run(["systemctl", "disable", "--now", "edge-studio-camera-helper.service"], check=False)
        if CAMERA_SERVICE_FILE.exists():
            CAMERA_SERVICE_FILE.unlink()
        run(["systemctl", "daemon-reload"], check=False)
    write_env({"ENABLE_CAMERA": "false"})
    config = read_env()
    restart = restart_backend(config)
    debug_log("disable camera completed", {"capability": camera_status(), "restart": restart}, config)
    return {"capability": camera_status(), "restart": restart}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return True
        except (BrokenPipeError, ConnectionResetError):
            debug_log("client disconnected before response", {"path": urlparse(self.path).path, "status": status})
            return False

    def authorized(self):
        if self.path == "/health":
            return True
        header = self.headers.get("Authorization", "")
        return bool(TOKEN) and secrets.compare_digest(header, f"Bearer {TOKEN}")

    def do_GET(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        path = urlparse(self.path).path
        debug_log("get request", {"path": path})
        try:
            if path == "/health":
                return self.send_json(200, {"status": "ok", "service": "edge-studio-host-agent"})
            if path == "/capabilities":
                return self.send_json(200, {"items": all_capabilities()})
            if path == "/capabilities/camera":
                return self.send_json(200, {"item": camera_status()})
            if path == "/capabilities/gpio":
                return self.send_json(200, {"item": gpio_status()})
            if path == "/capabilities/sensors":
                return self.send_json(200, {"item": sensor_status()})
            if path == "/capabilities/mqtt":
                return self.send_json(200, {"item": mqtt_status()})
            return self.send_json(404, {"error": "Not found"})
        except ValueError as error:
            return self.send_json(400, {"error": str(error), "capability": camera_status()})
        except Exception as error:
            if isinstance(error, (BrokenPipeError, ConnectionResetError)):
                debug_log("get client disconnected", {"path": path})
                return None
            debug_log("get error", {"path": path, "error": str(error)})
            return self.send_json(500, {"error": str(error)})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        path = urlparse(self.path).path
        debug_log("post request", {"path": path})
        try:
            if path == "/capabilities/camera/apply":
                return self.send_json(200, apply_camera())
            if path == "/capabilities/camera/disable":
                return self.send_json(200, disable_camera())
            if path == "/capabilities/gpio/apply":
                return self.send_json(200, apply_gpio())
            if path == "/capabilities/gpio/disable":
                return self.send_json(200, disable_gpio())
            if path == "/capabilities/mqtt/apply":
                return self.send_json(200, apply_mqtt())
            if path == "/capabilities/mqtt/disable":
                return self.send_json(200, disable_mqtt())
            if path == "/capabilities/sensors/apply":
                return self.send_json(200, apply_sensors())
            if path == "/capabilities/sensors/disable":
                return self.send_json(200, disable_sensors())
            return self.send_json(404, {"error": "Not found"})
        except ValueError as error:
            debug_log("post validation error", {"path": path, "error": str(error)})
            return self.send_json(400, {"error": str(error), "items": all_capabilities()})
        except Exception as error:
            if isinstance(error, (BrokenPipeError, ConnectionResetError)):
                debug_log("post client disconnected", {"path": path})
                return None
            debug_log("post error", {"path": path, "error": str(error)})
            return self.send_json(500, {"error": str(error)})


def main():
    if not TOKEN:
        raise SystemExit("HOST_AGENT_TOKEN is required")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"edge-studio-host-agent listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
