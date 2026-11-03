#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it with sudo apt-get install python3."
  exit 1
fi

python3 - "$@" <<'UNINSTALL_PY'
import argparse
import ipaddress
import json
import os
from pathlib import Path
import pwd
import shlex
import shutil
import subprocess
import sys


SERVICES = ("edge-studio-host-agent", "edge-studio-camera-helper", "edge-studio-sensor-helper")
CODE = (
    "backend", "frontend", "update-agent", "host-agent", "camera-helper", "sensor-helper",
    "bin", "scripts", "docker", "docs", "node_modules", ".git", ".github", ".agents",
    ".claude", ".cursor", ".venv-sensor-helper", ".env.example", "package-lock.json",
    "docker-compose.yml", "docker-compose.release.yml", "docker-compose.override.yml",
    "docker-compose.testnet.yml", "install.sh", "README.md", "SECURITY.md", "CHANGELOG.md",
    "AGENTS.md", "CLAUDE.md", "eslint.config.mjs", "vitest.scripts.config.mts",
    ".gitignore", ".prettierignore", ".prettierrc",
)


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode:
        # Command output can include environment values or service credentials.
        raise RuntimeError("Command failed: " + " ".join(args[:3]) + ". Fix the host service and rerun.")
    return result.stdout.strip()


def read_config(path):
    values = {}
    if path.is_symlink():
        raise ValueError("Refusing a symlinked configuration file.")
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.removeprefix("export ").partition("=")
            if separator:
                words = shlex.split(value, comments=True)
                values[key.strip()] = " ".join(words)
    return values


def inside(path, parent):
    return path == parent or parent in path.parents


def validate_app_dir(raw):
    path = Path(raw)
    if not path.is_absolute() or ".." in path.parts or path != path.resolve():
        raise ValueError("APP_DIR must be an absolute path without symlinks or '..'.")
    forbidden = {Path(p) for p in ("/", "/opt", "/usr", "/usr/local", "/var", "/var/lib", "/home", "/root", "/etc", "/tmp", "/mnt", "/media", "/srv")}
    forbidden.update(Path(user.pw_dir) for user in pwd.getpwall())
    if len(path.parts) < 3 or path in forbidden:
        raise ValueError("Refusing an unsafe or shared installation directory.")
    return path


def data_paths(app, config):
    def resolve(value):
        if any(character in value for character in ("$", "`", "\x00")):
            raise ValueError("Data paths must be literal paths, without shell expressions.")
        path = Path(value)
        return (path if path.is_absolute() else app / path).resolve()
    data = resolve(config.get("DATA_DIR") or "./data")
    camera = config.get("CAMERA_CAPTURE_DIR") or "/data/captures"
    capture = (data / camera.removeprefix("/data/")).resolve() if camera.startswith("/data/") else resolve(camera)
    paths = {data, resolve(config.get("MINIMA_DATA_DIR") or "./minima"),
             resolve(config.get("UPDATE_AGENT_STATE_DIR") or "./update-agent-state"), capture}
    if any(inside(app, path) for path in paths):
        raise ValueError("A data directory contains the installation directory; refusing automatic removal.")
    return paths


def mounted_below(path):
    if not path.is_dir():
        return False
    for root, directories, _ in os.walk(path, followlinks=False):
        if os.path.ismount(root) or any(os.path.ismount(Path(root) / name) for name in directories):
            return True
    return False


def owned_services(app, unit_dir):
    services = []
    for name in SERVICES:
        path = unit_dir / (name + ".service")
        if path.is_symlink():
            raise ValueError("Refusing a symlinked helper unit: " + name)
        if not path.exists():
            continue
        lines = path.read_text().splitlines()
        working = next((line.partition("=")[2] for line in lines if line.startswith("WorkingDirectory=")), "")
        if not working or Path(working).resolve() != app:
            raise ValueError("Helper unit belongs to another installation: " + name)
        services.append(path)
    return services


def docker_inventory(app):
    ids = run(["docker", "ps", "-aq", "--filter", "label=com.docker.compose.project"])
    containers = json.loads(run(["docker", "inspect", *ids.split()])) if ids else []
    owned = []
    projects = set()
    for container in containers:
        labels = container.get("Config", {}).get("Labels") or {}
        working = labels.get("com.docker.compose.project.working_dir")
        if working and Path(working).resolve() == app:
            owned.append(container["Id"])
            projects.add(labels.get("com.docker.compose.project"))
    return owned, projects


def firewall_rules(services):
    rules = []
    for path in services:
        text = path.read_text()
        values = dict(line.removeprefix("Environment=").split("=", 1)
                      for line in text.splitlines() if line.startswith("Environment=") and "=" in line.removeprefix("Environment="))
        key = {"edge-studio-host-agent": "HOST_AGENT_PORT", "edge-studio-camera-helper": "CAMERA_HELPER_PORT", "edge-studio-sensor-helper": "SENSOR_HELPER_PORT"}[path.stem]
        port = values.get(key, "")
        subnet = values.get("EDGE_STUDIO_DOCKER_SUBNET", "")
        if "iptables" not in text or not port.isdecimal() or not 1 <= int(port) <= 65535 or not subnet:
            continue
        ipaddress.IPv4Network(subnet)
        rule = ["INPUT", "-s", subnet, "-p", "tcp", "--dport", port, "-j", "ACCEPT"]
        if rule not in rules:
            rules.append(rule)
    return rules


def removal_paths(app, config, paths, delete_data):
    host_files = Path(config.get("HOST_FILES_DIR") or "/home/pi")
    host_files = (host_files if host_files.is_absolute() else app / host_files).resolve()
    preserved = {p for p in paths if not delete_data or not inside(p, app)}
    preserved.add(host_files)
    candidates = [app / name for name in CODE]
    if delete_data:
        candidates += [app / ".env", app / "package.json", app / "uninstall.sh"]
        candidates += [p for p in paths if inside(p, app)]
    removal = []
    for path in candidates:
        if not path.exists() and not path.is_symlink():
            continue
        # Check lexical and resolved paths before any recursive deletion.
        if not inside(path, app) or not inside(path.resolve(), app):
            continue
        if any(inside(path.resolve(), kept) or inside(kept, path.resolve()) for kept in preserved):
            continue
        if mounted_below(path):
            raise ValueError("Unmount nested filesystems before removing " + str(path))
        removal.append(path)
    # Remove descendants before ancestors; never recurse through symlinks.
    metadata = [app / ".env", app / "uninstall.sh", app / "package.json"]
    if any((not inside(p, app) or p.exists()) and not any(inside(p, target) for target in removal) for p in paths):
        removal = [p for p in removal if p not in metadata]
    return sorted(set(removal) - set(metadata), key=lambda p: len(p.parts), reverse=True) + [p for p in metadata if p in removal]


def show_plan(app, services, containers, paths, removal, delete_data, rules):
    print("\nEdge Studio uninstall: " + str(app))
    print("Mode: " + ("DELETE installation data" if delete_data else "Keep data (default)"))
    print("Services to remove: " + (", ".join(p.stem for p in services) or "none"))
    print("Owned containers to stop and remove: " + str(len(containers)))
    print("Remove the unused Edge Studio Compose network; retain it if shared.")
    for path in removal:
        print("  Remove: " + str(path))
    for path in sorted(paths):
        removed = any(inside(path, target) for target in removal)
        print(("  Delete data: " if removed else "  Keep data: ") + str(path))
    if app / ".env" not in removal:
        print("Keep configuration and encryption secret: " + str(app / ".env"))
    for rule in rules:
        print("  Matching legacy firewall rule (ownership requires confirmation): " + " ".join(rule))
    print("Docker, images, volumes, OS packages, external data, and unknown files are retained.")


def confirm(terminal, prompt):
    terminal.write(prompt)
    terminal.flush()
    answer = terminal.readline()
    if not answer:
        raise RuntimeError("Terminal input ended; uninstall cancelled.")
    return answer.strip()


def cleanup(app, config, services, containers, projects, removal, rules, remove_rules):
    # Stop the control agent first to prevent new hardware actions during removal.
    for path in services:
        run(["systemctl", "disable", "--now", path.name])
    if containers:
        run(["docker", "stop", "--time", "60", *containers])
        run(["docker", "rm", *containers])
    network_ids = run(["docker", "network", "ls", "-q", "--filter", "label=com.docker.compose.network=integritas"])
    if network_ids:
        for network in json.loads(run(["docker", "network", "inspect", *network_ids.split()])):
            labels = network.get("Labels") or {}
            project = labels.get("com.docker.compose.project")
            expected = projects or {config.get("COMPOSE_PROJECT_NAME") or app.name}
            if network.get("Name") == "edge-studio" and project in expected:
                if network.get("Containers"):
                    print("Retained Docker network: other containers are still attached.")
                else:
                    run(["docker", "network", "rm", network["Id"]])
    if remove_rules:
        for rule in rules:
            while True:
                result = subprocess.run(["iptables", "-C", *rule], capture_output=True, timeout=10)
                if result.returncode == 1:
                    break
                if result.returncode != 0:
                    raise RuntimeError("Cannot check firewall rules; configuration retained for retry.")
                run(["iptables", "-D", *rule])
    # Remove the host-agent unit last.
    for path in reversed(services):
        path.unlink()
    if services:
        run(["systemctl", "daemon-reload"])
    cli = Path("/usr/local/bin/edge-studio")
    source = app / "bin/edge-studio"
    if cli.is_file() and source.is_file() and cli.read_bytes() == source.read_bytes():
        cli.unlink()
    elif cli.exists():
        print("Retained CLI: ownership could not be verified.")
    os.chdir("/")
    for path in removal:
        if app != app.resolve() or not inside(path.resolve(), app):
            raise ValueError("Removal path changed or escapes the installation: " + str(path))
        if mounted_below(path):
            raise ValueError("A mounted filesystem appeared during removal: " + str(path))
        if path.is_symlink() or path.is_file():
            path.unlink(missing_ok=True)
        elif path.exists():
            shutil.rmtree(path)
    if app.exists() and not any(app.iterdir()) and not os.path.ismount(app):
        app.rmdir()


def main():
    parser = argparse.ArgumentParser(description="Uninstall Edge Studio; keep data by default.")
    parser.add_argument("--delete-data", action="store_true", help="Delete validated data inside APP_DIR, with typed confirmation")
    parser.add_argument("--dry-run", action="store_true", help="Show the removal plan without changing anything")
    args = parser.parse_args()
    if sys.platform != "linux" or os.geteuid() != 0:
        raise RuntimeError("Run this uninstaller on Linux with sudo.")
    app = validate_app_dir(os.environ.get("APP_DIR", "/opt/edge-studio"))
    config = read_config(app / ".env")
    services = owned_services(app, Path("/etc/systemd/system"))
    containers, projects = docker_inventory(app)
    package = app / "package.json"
    known = False
    if package.is_file() and not package.is_symlink():
        try:
            known = json.loads(package.read_text()).get("name") == "edge-studio"
        except (ValueError, AttributeError):
            pass
    if app.exists() and not known and not services and not containers:
        raise ValueError("Cannot verify this directory as an Edge Studio installation; no files were removed.")
    paths = data_paths(app, config)
    if not app.exists() and not services and not containers:
        print("No Edge Studio installation found at " + str(app) + ". Nothing to remove.")
        return
    rules = firewall_rules(services)
    terminal = None
    try:
        if not args.dry_run:
            try:
                terminal = open("/dev/tty", "r+")
            except OSError:
                raise RuntimeError("An interactive terminal is required for uninstall confirmation. Use --dry-run to preview.")
            if not args.delete_data:
                choice = confirm(terminal, "1. Uninstall, keep data (default)\n2. Uninstall and delete installation data\nChoose [1]: ")
                if choice not in ("", "1", "2"):
                    raise ValueError("Invalid choice; uninstall cancelled.")
                args.delete_data = choice == "2"
        removal = removal_paths(app, config, paths, args.delete_data)
        if args.delete_data and not (app / ".env").exists() and any(p.exists() for p in paths):
            raise ValueError("Configuration is missing; data ownership cannot be verified. Use keep-data removal and review data manually.")
        show_plan(app, services, containers, paths, removal, args.delete_data, rules)
        if args.dry_run:
            return
        remove_rules = False
        if rules and shutil.which("iptables"):
            remove_rules = confirm(terminal, "Were these exact firewall rules created only for this installation? Remove them? [y/N]: ").lower() == "y"
        phrase = "DELETE EDGE STUDIO DATA" if args.delete_data else "UNINSTALL"
        if args.delete_data:
            print("Deleting Minima data also deletes the local wallet and any backups stored there. Back up what you need first.")
        if confirm(terminal, "Type '" + phrase + "' to continue: ") != phrase:
            print("Uninstall cancelled. No changes made.")
            return
        cleanup(app, config, services, containers, projects, removal, rules, remove_rules)
        print("\nEdge Studio uninstalled.")
        if app.exists():
            print("Retained files: " + str(app))
        if (app / ".env").exists():
            print("Reinstall with the same APP_DIR to reuse .env and retained data: " + str(app))
        if rules and not remove_rules:
            print("Legacy firewall rules retained. The exact rules are listed above for manual review.")
    finally:
        if terminal:
            terminal.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
        print("Uninstall stopped: " + str(error), file=sys.stderr)
        print("Removal may be incomplete. Configuration is retained until file cleanup; fix the reported issue and rerun.", file=sys.stderr)
        sys.exit(1)
UNINSTALL_PY
