import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";

it("uninstalls only owned resources and requires explicit consent for data deletion", () => {
  const script = readFileSync(join(process.cwd(), "uninstall.sh"), "utf8").replaceAll("\r\n", "\n");
  const match = script.match(/<<'UNINSTALL_PY'\n([\s\S]*?)\nUNINSTALL_PY/);
  assert.ok(match);
  const result = spawnSync(process.platform === "win32" ? "python" : "python3", ["-"], {
    encoding: "utf8",
    input: `
import contextlib
import io
import json
import os
import select
from pathlib import Path
import sys
import time
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
if sys.platform == "win32":
    sys.modules["pwd"] = SimpleNamespace(getpwall=lambda: [])
scope = {"__name__": "uninstall"}
exec(${JSON.stringify(match[1])}, scope)

class UninstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.app = self.root / "edge-studio"
        self.app.mkdir()
        self.units = self.root / "units"
        self.units.mkdir()
        self.cwd = Path.cwd()
        self.write("package.json", '{"name":"edge-studio"}')
        self.write(".env", "APP_SECRET=keep-this-secret\\nDATA_DIR=./data\\n")
        for name in ("data/edge-studio.db", "data/certs/key.pem", "data/captures/photo.jpg", "minima/wallet.dat", "minima/backups/backup.bak", "update-agent-state/last-applied-manifest.json", "backend/server.js", "uninstall.sh", "personal-notes.txt"):
            self.write(name, "retained-content")
        self.paths = scope["data_paths"](self.app, {})

    def tearDown(self):
        os.chdir(self.cwd)
        self.temp.cleanup()

    def write(self, name, content):
        path = self.app / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def perform(self, delete=False, services=(), containers=(), rules=(), remove_rules=False, fail=False):
        removal = scope["removal_paths"](self.app, {}, self.paths, delete)
        calls = []
        def command(args):
            calls.append(args)
            if fail:
                raise RuntimeError("host cleanup failed")
            return ""
        def paths(value):
            return self.root / "cli" if str(value) == "/usr/local/bin/edge-studio" else Path(value)
        with patch.dict(scope, run=command, Path=paths):
            scope["cleanup"](self.app, {}, services, list(containers), set(), removal, rules, remove_rules)
        return calls

    def test_keep_data_preserves_database_wallet_backups_certificates_configuration_and_unknown_files(self):
        self.perform(containers=["owned-id"])
        for name in (".env", "package.json", "uninstall.sh", "data/edge-studio.db", "data/certs/key.pem", "minima/wallet.dat", "minima/backups/backup.bak", "personal-notes.txt"):
            self.assertTrue((self.app / name).exists(), name)
        self.assertFalse((self.app / "backend").exists())
        self.assertIn("keep-this-secret", (self.app / ".env").read_text())
        self.perform()  # Retried removal must preserve the same data.
        self.assertTrue((self.app / "minima/wallet.dat").exists())

    def test_delete_data_removes_managed_data_but_preserves_unknown_files(self):
        self.perform(delete=True)
        for name in ("data", "minima", "update-agent-state", ".env", "package.json", "uninstall.sh", "backend"):
            self.assertFalse((self.app / name).exists(), name)
        self.assertTrue((self.app / "personal-notes.txt").exists())

    def test_external_data_and_host_files_are_never_deleted(self):
        external = self.root / "external"
        external.mkdir()
        (external / "precious.txt").write_text("preserve")
        config = {"DATA_DIR": str(external), "MINIMA_DATA_DIR": str(self.app / "backend"), "HOST_FILES_DIR": str(self.app / "backend")}
        paths = scope["data_paths"](self.app, config)
        removal = scope["removal_paths"](self.app, config, paths, True)
        self.assertNotIn(external, removal)
        self.assertNotIn(self.app / "backend", removal)
        self.assertNotIn(self.app / ".env", removal)
        self.assertNotIn(self.app / "package.json", removal)
        self.assertTrue((external / "precious.txt").exists())
        config["DATA_DIR"] = str(self.root / "offline-drive")
        removal = scope["removal_paths"](self.app, config, scope["data_paths"](self.app, config), True)
        self.assertNotIn(self.app / ".env", removal)

    def test_custom_internal_data_inside_code_is_preserved_in_keep_mode(self):
        config = {"DATA_DIR": "./backend/storage"}
        self.write("backend/storage/edge-studio.db", "db")
        removal = scope["removal_paths"](self.app, config, scope["data_paths"](self.app, config), False)
        self.assertNotIn(self.app / "backend", removal)

    def test_unsafe_roots_ancestors_shell_paths_and_nested_mounts_are_refused(self):
        for path in ("/", "/opt", "/home", "relative", str(self.app / "..")):
            with self.assertRaises(ValueError):
                scope["validate_app_dir"](path)
        for value in ("./", "../", "$(touch forbidden)"):
            with self.assertRaises(ValueError):
                scope["data_paths"](self.app, {"DATA_DIR": value})
        with patch.dict(scope, mounted_below=lambda _: True):
            with self.assertRaises(ValueError):
                scope["removal_paths"](self.app, {}, self.paths, True)

    def test_dotenv_is_parsed_without_executing_shell(self):
        self.write(".env", 'DATA_DIR="./custom data"\\nAPP_SECRET=$(touch secret-leak)\\nexport MINIMA_DATA_DIR=./node # note\\n')
        values = scope["read_config"](self.app / ".env")
        self.assertEqual(values["DATA_DIR"], "./custom data")
        self.assertEqual(values["MINIMA_DATA_DIR"], "./node")
        self.assertFalse((self.app / "secret-leak").exists())

    def test_failed_host_cleanup_preserves_data_and_retry_configuration(self):
        with self.assertRaisesRegex(RuntimeError, "host cleanup failed"):
            self.perform(delete=True, containers=["owned"], fail=True)
        self.assertTrue((self.app / ".env").exists())
        self.assertTrue((self.app / "backend/server.js").exists())
        self.assertTrue((self.app / "minima/wallet.dat").exists())

    def test_docker_inventory_selects_only_this_installation_including_stopped_containers(self):
        def container(identifier, directory):
            return {"Id": identifier, "Config": {"Labels": {"com.docker.compose.project.working_dir": directory, "com.docker.compose.project": "edge-studio"}}}
        data = [container("ours", str(self.app)), container("theirs", str(self.root / "another-app"))]
        with patch.dict(scope, run=lambda args: "one two" if args[1] == "ps" else json.dumps(data)):
            self.assertEqual(scope["docker_inventory"](self.app), (["ours"], {"edge-studio"}))
        calls = self.perform(containers=["ours"])
        self.assertIn(["docker", "stop", "--time", "60", "ours"], calls)
        self.assertIn(["docker", "rm", "ours"], calls)
        self.assertFalse(any("prune" in c or "volume" in c for c in calls))

    def test_service_ownership_and_custom_firewall_values(self):
        path = self.units / "edge-studio-host-agent.service"
        display = self.units / "edge-studio-display-helper.service"
        path.write_text("WorkingDirectory=" + str(self.app) + "\\nEnvironment=HOST_AGENT_PORT=48182\\nEnvironment=EDGE_STUDIO_DOCKER_SUBNET=172.31.0.0/24\\nExecStartPre=iptables -C INPUT\\n")
        display.write_text("WorkingDirectory=" + str(self.app) + "\\nEnvironment=DISPLAY_HELPER_PORT=48183\\nEnvironment=EDGE_STUDIO_DOCKER_SUBNET=172.31.0.0/24\\nExecStartPre=iptables -C INPUT\\n")
        services = scope["owned_services"](self.app, self.units)
        self.assertEqual(services, [path, display])
        self.assertEqual(scope["firewall_rules"](services), [
            ["INPUT", "-s", "172.31.0.0/24", "-p", "tcp", "--dport", "48182", "-j", "ACCEPT"],
            ["INPUT", "-s", "172.31.0.0/24", "-p", "tcp", "--dport", "48183", "-j", "ACCEPT"],
        ])
        with self.assertRaisesRegex(ValueError, "another installation"):
            scope["owned_services"](self.root / "another-install", self.units)

    def test_interactive_cancellation_and_dry_run_make_no_changes(self):
        for options, answers in [([], "1\\nwrong\\n"), ([], "2\\nUNINSTALL\\n"), (["--delete-data"], "wrong\\n"), (["--dry-run"], "")]:
            terminal = io.StringIO(answers)
            with patch.dict(scope, owned_services=lambda *a: [], docker_inventory=lambda _: ([], set())):
                with patch.object(sys, "argv", ["uninstall", *options]), patch.object(sys, "platform", "linux"), patch.object(os, "geteuid", return_value=0, create=True), patch.dict(os.environ, APP_DIR=str(self.app)):
                    with patch("builtins.open", side_effect=lambda path, mode: terminal if mode == "r" else io.StringIO()), contextlib.redirect_stdout(io.StringIO()), patch.dict(scope, cleanup=lambda *a: self.fail("Unconfirmed cleanup")):
                        scope["main"]()
            self.assertTrue((self.app / "minima/wallet.dat").exists())

    def test_confirmed_default_keeps_data_and_confirmed_delete_requires_the_full_phrase(self):
        for answers, delete in [("\\nUNINSTALL\\n", False), ("2\\nDELETE EDGE STUDIO DATA\\n", True)]:
            terminal = io.StringIO(answers)
            calls = []
            with patch.dict(scope, owned_services=lambda *a: [], docker_inventory=lambda _: ([], set()), cleanup=lambda *a: calls.append(a)):
                with patch.object(sys, "argv", ["uninstall"]), patch.object(sys, "platform", "linux"), patch.object(os, "geteuid", return_value=0, create=True), patch.dict(os.environ, APP_DIR=str(self.app)):
                    with patch("builtins.open", side_effect=lambda path, mode: terminal if mode == "r" else io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                        scope["main"]()
            self.assertEqual(len(calls), 1)
            self.assertEqual(self.app / ".env" in calls[0][5], delete)

    def test_firewall_rules_are_untouched_without_explicit_consent(self):
        rule = ["INPUT", "-s", "172.31.0.0/24", "-p", "tcp", "--dport", "48182", "-j", "ACCEPT"]
        calls = []
        def command(args):
            calls.append(args)
            return ""
        with patch.dict(scope, run=command):
            with patch.object(scope["subprocess"], "run", side_effect=[SimpleNamespace(returncode=0), SimpleNamespace(returncode=1)]) as check:
                scope["cleanup"](self.app, {}, [], [], set(), [], [rule], False)
                check.assert_not_called()
                scope["cleanup"](self.app, {}, [], [], set(), [], [rule], True)
                self.assertIn(["iptables", "-D", *rule], calls)
                self.assertEqual(check.call_count, 2)

    def test_shared_and_foreign_networks_are_retained(self):
        for attached, project, removed in [(True, "edge-studio", False), (False, "foreign", False), (False, "edge-studio", True)]:
            calls = []
            def command(args):
                calls.append(args)
                if args[1:3] == ["network", "ls"]:
                    return "network-id"
                if args[1:3] == ["network", "inspect"]:
                    return json.dumps([{"Name": "edge-studio", "Id": "network-id", "Labels": {"com.docker.compose.project": project}, "Containers": {"other": {}} if attached else {}}])
                return ""
            with patch.dict(scope, run=command), contextlib.redirect_stdout(io.StringIO()):
                scope["cleanup"](self.app, {}, [], [], {"edge-studio"}, [], [], False)
            self.assertEqual(["docker", "network", "rm", "network-id"] in calls, removed)

    def test_confirmation_eof_cancels(self):
        terminal = io.StringIO()
        with patch("builtins.open", return_value=io.StringIO()), self.assertRaisesRegex(RuntimeError, "cancelled"):
            scope["confirm"](terminal, "Confirm: ")

    def test_missing_controlling_terminal_prevents_cleanup(self):
        with patch.dict(scope, owned_services=lambda *a: [], docker_inventory=lambda _: ([], set()), cleanup=lambda *a: self.fail("Unconfirmed cleanup")):
            with patch.object(sys, "argv", ["uninstall", "--delete-data"]), patch.object(sys, "platform", "linux"), patch.object(os, "geteuid", return_value=0, create=True), patch.dict(os.environ, APP_DIR=str(self.app)):
                with patch("builtins.open", side_effect=OSError("no controlling terminal")), self.assertRaisesRegex(RuntimeError, "interactive terminal is required"):
                    scope["main"]()
        self.assertTrue((self.app / "minima/wallet.dat").exists())

    if sys.platform == "linux":
        def test_piped_stdin_with_real_controlling_terminal_can_cancel_delete(self):
            import pty
            child, terminal = pty.fork()
            if child == 0:
                try:
                    # Like curl | bash and the embedded Python heredoc: stdin is not a tty.
                    pipe_read, pipe_write = os.pipe()
                    os.close(pipe_write)
                    os.dup2(pipe_read, 0)
                    os.close(pipe_read)
                    with patch.dict(scope, owned_services=lambda *a: [], docker_inventory=lambda _: ([], set()), cleanup=lambda *a: os._exit(2)):
                        with patch.object(sys, "argv", ["uninstall", "--delete-data"]), patch.object(os, "geteuid", return_value=0), patch.dict(os.environ, APP_DIR=str(self.app)):
                            scope["main"]()
                    os._exit(0)
                except BaseException as error:
                    print(str(error), flush=True)
                    os._exit(1)
            output = b""
            reaped = False
            try:
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline:
                    if select.select([terminal], [], [], 0.1)[0]:
                        try:
                            output += os.read(terminal, 65536)
                        except OSError:
                            break
                        if b"Type 'DELETE EDGE STUDIO DATA'" in output:
                            os.write(terminal, b"cancel\\n")
                            break
                self.assertIn(b"Type 'DELETE EDGE STUDIO DATA'", output)
                while time.monotonic() < deadline:
                    finished, status = os.waitpid(child, os.WNOHANG)
                    if finished:
                        reaped = True
                        self.assertEqual(os.waitstatus_to_exitcode(status), 0)
                        break
                    time.sleep(0.01)
                else:
                    self.fail("Uninstaller did not exit after cancellation")
            finally:
                os.close(terminal)
                if not reaped:
                    os.kill(child, 9)
                    os.waitpid(child, 0)
            self.assertTrue((self.app / "minima/wallet.dat").exists())

unittest.main()
`,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
