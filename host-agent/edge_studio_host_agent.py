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
CAMERA_SERVICE_FILE = Path("/etc/systemd/system/edge-studio-camera-helper.service")


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


def is_truthy(value):
    return str(value or "").lower() in {"1", "true", "yes", "on"}


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
    subprocess.Popen(["/bin/sh", "-c", f"sleep 1; {command}"], cwd=str(APP_DIR))
    return {"ok": True, "scheduled": True}


def ensure_camera_token(config):
    token = config.get("CAMERA_HELPER_TOKEN", "")
    if token:
        return token
    return secrets.token_hex(32)


def missing_camera_tools_message():
    if shutil.which("rpicam-still") or shutil.which("libcamera-still"):
        return None
    return "Neither rpicam-still nor libcamera-still was found on the host. Install or enable the Raspberry Pi camera stack on the host, then refresh Hardware support."


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


def apply_camera():
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
    return {"capability": camera_status(), "restart": restart, "warning": None}


def disable_camera():
    if shutil.which("systemctl"):
        run(["systemctl", "disable", "--now", "edge-studio-camera-helper.service"], check=False)
        if CAMERA_SERVICE_FILE.exists():
            CAMERA_SERVICE_FILE.unlink()
        run(["systemctl", "daemon-reload"], check=False)
    write_env({"ENABLE_CAMERA": "false"})
    config = read_env()
    restart = restart_backend(config)
    return {"capability": camera_status(), "restart": restart}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if self.path == "/health":
            return True
        header = self.headers.get("Authorization", "")
        return bool(TOKEN) and secrets.compare_digest(header, f"Bearer {TOKEN}")

    def do_GET(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        path = urlparse(self.path).path
        try:
            if path == "/health":
                return self.send_json(200, {"status": "ok", "service": "edge-studio-host-agent"})
            if path == "/capabilities":
                return self.send_json(200, {"items": [camera_status()]})
            if path == "/capabilities/camera":
                return self.send_json(200, {"item": camera_status()})
            return self.send_json(404, {"error": "Not found"})
        except ValueError as error:
            return self.send_json(400, {"error": str(error), "capability": camera_status()})
        except Exception as error:
            return self.send_json(500, {"error": str(error)})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        path = urlparse(self.path).path
        try:
            if path == "/capabilities/camera/apply":
                return self.send_json(200, apply_camera())
            if path == "/capabilities/camera/disable":
                return self.send_json(200, disable_camera())
            return self.send_json(404, {"error": "Not found"})
        except Exception as error:
            return self.send_json(500, {"error": str(error)})


def main():
    if not TOKEN:
        raise SystemExit("HOST_AGENT_TOKEN is required")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"edge-studio-host-agent listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
