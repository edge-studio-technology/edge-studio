import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";

const installer = readFileSync(join(process.cwd(), "install.sh"), "utf8").replaceAll("\r\n", "\n");

function readFunction(name: string) {
  const match = installer.match(new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}\\n(?=\\n|$)`, "m"));
  assert.ok(match, `Missing ${name}`);
  return match[0];
}

function bash(body: string, input = "") {
  const dir = mkdtempSync(join(tmpdir(), "install-port-script-"));
  const script = join(dir, "test.sh");
  try {
    writeFileSync(script, `
ADVANCED_INSTALL=false
FRONTEND_PORT=8080 MINIMA_P2P_PORT=9003 MINIMA_RPC_PORT=9005 HOST_AGENT_PORT=38182
CAMERA_HELPER_PORT=38180 SENSOR_HELPER_PORT=38181 MQTT_PUBLIC_PORT=1883
${["parse_arguments", "valid_port", "prompt_port", "configure_ports"].map(readFunction).join("\n")}
${readFunction("is_truthy")}
${body}`);
    return spawnSync("bash", ["-euo", "pipefail", script.replaceAll("\\", "/")], { input, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("installer port configuration", () => {
  it("accepts the advanced flag and rejects unknown options", () => {
    const advanced = bash('parse_arguments --advanced; echo "$ADVANCED_INSTALL"');
    assert.equal(advanced.status, 0, advanced.stderr);
    assert.equal(advanced.stdout.trim(), "true");
    assert.notEqual(bash("parse_arguments --advnaced").status, 0);
    assert.equal(bash("parse_arguments --help").status, 0);
  });

  it("validates ports and rejects shell expressions without evaluating them", () => {
    for (const value of ["0", "65536", "-1", "abc", "1+2", "123456", "1;exit 0"]) {
      const result = bash(`FRONTEND_PORT='${value}'; configure_ports`);
      assert.notEqual(result.status, 0, value);
      assert.match(result.stderr, /Invalid FRONTEND_PORT/);
    }
    const valid = bash('FRONTEND_PORT=00080; MINIMA_P2P_PORT=65535; configure_ports; echo "$FRONTEND_PORT"');
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(valid.stdout.trim(), "80");
  });

  it("rejects duplicate ports including ports saved for optional services", () => {
    const result = bash("CAMERA_HELPER_PORT=8080; configure_ports");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CAMERA_HELPER_PORT and FRONTEND_PORT both use port 8080/);
  });

  it("explains the headless alternative when the terminal cannot be opened", () => {
    const result = bash(`
${readFunction("configure_ports").replace("/dev/tty", "/nonexistent-edge-studio-terminal/tty")}
parse_arguments --advanced
configure_ports`);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires a terminal/);
    assert.match(result.stderr, /sudo env/);
  });

  it("keeps saved values and explicit environment overrides on rerun", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-ports-"));
    try {
      writeFileSync(join(dir, ".env"), "FRONTEND_PORT=8443\nMINIMA_P2P_PORT=19003\n");
      const result = bash(`
APP_DIR='${dir.replaceAll("\\", "/")}'
log() { :; }
${readFunction("load_existing_config")}
FRONTEND_PORT_INPUT=9443
RUNTIME_BUNDLE_URL_INPUT=
DEFAULT_MANIFEST_URL=unused
load_existing_config
configure_ports
echo "$FRONTEND_PORT $MINIMA_P2P_PORT"`);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "9443 19003");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retries invalid prompt input, accepts custom values, and keeps defaults on Enter", () => {
    // fd 4 supplies answers at the terminal-read boundary; fd 3 captures prompts.
    const body = `exec 4<&0 3>&1
read() { builtin read "$@" <&4; }
prompt_port FRONTEND_PORT "HTTPS port"
prompt_port MINIMA_P2P_PORT "Minima port"
echo "ports=$FRONTEND_PORT,$MINIMA_P2P_PORT"`;
    const result = bash(body, "65536\n08443\n\n");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Enter a port number from 1 to 65535/);
    assert.match(result.stdout, /ports=8443,9003/);
    const eof = bash(body);
    assert.notEqual(eof.status, 0);
    assert.match(eof.stderr, /terminal input ended/);
  });

  it("writes selected ports and helper URLs to the runtime configuration", () => {
    const dir = mkdtempSync(join(tmpdir(), "install-port-env-"));
    try {
      const result = bash(`
${installer.slice(0, installer.indexOf("# Install-time bootstrap"))}
APP_DIR='${dir.replaceAll("\\", "/")}'
log() { :; }
${readFunction("write_env_file")}
FRONTEND_PORT=8443 HOST_AGENT_PORT=48182 CAMERA_HELPER_PORT=48180 SENSOR_HELPER_PORT=48181
MINIMA_P2P_PORT=19003 MINIMA_RPC_PORT=19005 MQTT_PUBLIC_PORT=11883
FRONTEND_IMAGE=frontend BACKEND_IMAGE=backend UPDATE_AGENT_IMAGE=update-agent
configure_ports
write_env_file`);
      assert.equal(result.status, 0, result.stderr);
      const env = readFileSync(join(dir, ".env"), "utf8");
      for (const line of ["FRONTEND_PORT=8443", "MINIMA_P2P_PORT=19003", "MINIMA_RPC_PORT=19005", "MQTT_PUBLIC_PORT=11883", "HOST_AGENT_URL=http://172.30.0.1:48182", "CAMERA_HELPER_URL=http://172.30.0.1:48180", "SENSOR_HELPER_URL=http://172.30.0.1:48181", "ENABLE_CAMERA=false", "ENABLE_SENSORS=false", "ENABLE_MQTT_BROKER=false", "MINIMA_RPC_BIND=127.0.0.1"]) {
        assert.ok(env.split("\n").includes(line), line);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks ports before host mutations and downloads", () => {
    const main = readFunction("main");
    for (const action of ["install_apt_dependencies", "install_docker_if_missing", "download_app", "write_env_file", "install_host_agent"]) {
      assert.ok(main.indexOf("  check_port_conflicts\n") < main.indexOf(`  ${action}\n`));
    }
    assert.ok(main.indexOf("  load_existing_config\n") < main.indexOf("  configure_ports\n"));
  });
});

describe("installer TCP preflight", () => {
  it("detects listeners and Docker publications, and permits only owned services on reruns", () => {
    const match = installer.match(/<<'PORT_PREFLIGHT_PY'\n([\s\S]*?)\nPORT_PREFLIGHT_PY/);
    assert.ok(match);
    const result = spawnSync(process.platform === "win32" ? "python" : "python3", ["-"], {
      encoding: "utf8",
      input: `
import contextlib
import io
import unittest
from unittest.mock import patch, MagicMock
scope = {"__name__": "preflight"}
exec(${JSON.stringify(match[1])}, scope)
check = scope["check_ports"]
args = ["/opt/edge-studio", "127.0.0.1", "8080", "9003", "9005", "38182", "38180", "38181", "1883", "false", "false", "false"]

class PreflightTests(unittest.TestCase):
    def run_check(self, bindings=(), busy=False, owned_helper=False, values=None):
        probe = MagicMock()
        if busy:
            probe.bind.side_effect = OSError(scope["errno"].EADDRINUSE, "busy")
        output = io.StringIO()
        with patch.dict(scope, container_bindings=lambda _: bindings, helper_owns_port=lambda *a: owned_helper):
            with patch.object(scope["socket"], "socket") as socket_factory, contextlib.redirect_stderr(output):
                socket_factory.return_value.__enter__.return_value = probe
                code = check(values or args)
        return code, output.getvalue(), probe.bind.call_args_list

    def test_free_ports_and_disabled_optional_services(self):
        code, output, calls = self.run_check()
        self.assertEqual(code, 0, output)
        tested = {call.args[0][1] for call in calls}
        self.assertEqual(tested, {8080, 9003, 9005, 38182})

    def test_enabled_optional_services(self):
        code, output, calls = self.run_check(values=args[:9] + ["true", "true", "true"])
        self.assertEqual(code, 0, output)
        self.assertTrue({38180, 38181, 1883}.issubset({c.args[0][1] for c in calls}))

    def test_foreign_listener_and_recovery_message(self):
        code, output, _ = self.run_check(busy=True)
        self.assertEqual(code, 1)
        self.assertIn("8080 is already in use", output)
        self.assertIn("--advanced", output)

    def test_foreign_docker_publication_even_without_proxy(self):
        code, output, _ = self.run_check(bindings=[("0.0.0.0", 8080, None, "443/tcp")])
        self.assertEqual(code, 1)
        self.assertIn("another Docker service", output)

    def test_owned_container_and_helper_rerun(self):
        bindings = [(address, port, service, target) for address in ("0.0.0.0", "::", "127.0.0.1")
                    for port, service, target in [(8080, "frontend", "443/tcp"), (9003, "minima", "9003/tcp"), (9005, "minima", "9005/tcp")]]
        code, output, _ = self.run_check(bindings=bindings, busy=True, owned_helper=True)
        self.assertEqual(code, 0, output)

    def test_owned_service_cannot_claim_another_services_port(self):
        code, output, _ = self.run_check(bindings=[("0.0.0.0", 8080, "minima", "9003/tcp")])
        self.assertEqual(code, 1)
        self.assertIn("another Docker service", output)

    def test_docker_labels_require_matching_install_directory(self):
        import json
        from types import SimpleNamespace
        container = {"Config": {"Labels": {"com.docker.compose.project.working_dir": "/elsewhere", "com.docker.compose.service": "frontend"}},
                     "NetworkSettings": {"Ports": {"443/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}}}
        with patch.object(scope["shutil"], "which", return_value="docker"), patch.object(scope["subprocess"], "run", return_value=SimpleNamespace(returncode=0, stdout="id")):
            with patch.dict(scope, command=lambda _: json.dumps([container])):
                app_dir = scope["os"].path.realpath("/opt/edge-studio")
                self.assertIsNone(scope["container_bindings"](app_dir)[0][2])
                container["Config"]["Labels"]["com.docker.compose.project.working_dir"] = "/opt/edge-studio"
                self.assertEqual(scope["container_bindings"](app_dir)[0][2], "frontend")

    def test_unavailable_docker_daemon_fails_preflight(self):
        from types import SimpleNamespace
        with patch.object(scope["shutil"], "which", return_value="docker"), patch.object(scope["subprocess"], "run", return_value=SimpleNamespace(returncode=1, stdout="")):
            with self.assertRaisesRegex(RuntimeError, "Start the Docker daemon"):
                scope["container_bindings"]("/opt/edge-studio")

    def test_helper_requires_matching_process_directory_and_listener_inode(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "123" / "fd").mkdir(parents=True)
            (root / "123" / "fd" / "5").touch()
            (root / "net").mkdir()
            (root / "net" / "tcp").write_text("header\\n 0: 00000000:9526 00000000:0000 0A 0:0 0:0 0 0 0 456\\n")
            def proc_path(value):
                return root / value.removeprefix("/proc").lstrip("/")
            realpath = scope["os"].path.realpath
            def cwd_path(value):
                return "/opt/edge-studio" if str(value).endswith("cwd") else realpath(value)
            with patch.dict(scope, command=lambda _: "123", Path=proc_path):
                with patch.object(scope["os"].path, "realpath", side_effect=cwd_path), patch.object(scope["os"], "readlink", return_value="socket:[456]"):
                    self.assertTrue(scope["helper_owns_port"]("edge-studio-host-agent.service", 38182, "/opt/edge-studio"))
                    self.assertFalse(scope["helper_owns_port"]("edge-studio-host-agent.service", 38183, "/opt/edge-studio"))
                    self.assertFalse(scope["helper_owns_port"]("edge-studio-host-agent.service", 38182, "/another-install"))
                with patch.object(scope["os"].path, "realpath", side_effect=cwd_path), patch.object(scope["os"], "readlink", return_value="socket:[999]"):
                    self.assertFalse(scope["helper_owns_port"]("edge-studio-host-agent.service", 38182, "/opt/edge-studio"))

    def test_real_listener_is_detected(self):
        with scope["socket"].socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            values = args.copy()
            values[4] = str(listener.getsockname()[1])
            output = io.StringIO()
            with patch.dict(scope, container_bindings=lambda _: []), contextlib.redirect_stderr(output):
                self.assertEqual(check(values), 1)
            self.assertIn("Minima RPC", output.getvalue())

unittest.main()
`,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
});
