import importlib.util
import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
HOST_AGENT_PATH = ROOT / "host-agent" / "edge_studio_host_agent.py"


def load_agent():
    spec = importlib.util.spec_from_file_location("edge_studio_host_agent", HOST_AGENT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def host_runtime_artifact(files):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, content in files.items():
            data = content.encode("utf-8")
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


class HostAgentWriteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.agent = load_agent()
        self.agent.APP_DIR = self.root
        self.agent.ENV_FILE = self.root / ".env"
        self.agent.COMPOSE_OVERRIDE_FILE = self.root / "docker-compose.override.yml"
        self.agent.CAMERA_SERVICE_FILE = self.root / "edge-studio-camera-helper.service"
        self.agent.SENSOR_SERVICE_FILE = self.root / "edge-studio-sensor-helper.service"

    def tearDown(self):
        self.tmp.cleanup()

    def test_atomic_write_keeps_existing_file_when_replace_fails(self):
        target = self.root / "target.txt"
        target.write_text("original\n", encoding="utf-8")

        with patch.object(self.agent.os, "replace", side_effect=RuntimeError("replace failed")):
            with self.assertRaisesRegex(RuntimeError, "replace failed"):
                self.agent.write_text_atomic(target, "updated\n")

        self.assertEqual(target.read_text(encoding="utf-8"), "original\n")
        self.assertEqual(list(self.root.glob(".target.txt.*.tmp")), [])

    def test_write_env_preserves_unrelated_values_and_comments(self):
        self.agent.ENV_FILE.write_text(
            "# existing comment\n"
            "KEEP_ME=true\n"
            "ENABLE_GPIO=false\n"
            "\n"
            "# trailing comment\n",
            encoding="utf-8",
        )

        self.agent.write_env({"ENABLE_GPIO": "true", "GPIO_GID": "997"})

        self.assertEqual(
            self.agent.ENV_FILE.read_text(encoding="utf-8"),
            "# existing comment\n"
            "KEEP_ME=true\n"
            "ENABLE_GPIO=true\n"
            "\n"
            "# trailing comment\n"
            "GPIO_GID=997\n",
        )

    def test_write_env_collapses_duplicate_updated_keys(self):
        self.agent.ENV_FILE.write_text(
            "ENABLE_CAMERA=false\n"
            "KEEP_ME=true\n"
            "ENABLE_CAMERA=old-duplicate\n",
            encoding="utf-8",
        )

        self.agent.write_env({"ENABLE_CAMERA": "true"})

        content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertEqual(content.count("ENABLE_CAMERA="), 1)
        self.assertIn("ENABLE_CAMERA=true", content)
        self.assertIn("KEEP_ME=true", content)

    def test_update_compose_profiles_is_idempotent(self):
        config = {"COMPOSE_PROFILES": "mqtt,other,mqtt,, other"}

        enabled = self.agent.update_compose_profiles(config, "mqtt", True)
        disabled = self.agent.update_compose_profiles({"COMPOSE_PROFILES": enabled}, "mqtt", False)

        self.assertEqual(enabled, "mqtt,other")
        self.assertEqual(disabled, "other")

    def test_gpio_override_does_not_replace_user_managed_file(self):
        self.agent.COMPOSE_OVERRIDE_FILE.write_text(
            "services:\n"
            "  backend:\n"
            "    environment:\n"
            "      CUSTOM: true\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValueError, "user-managed"):
            self.agent.write_gpio_override({"ENABLE_GPIO": "true", "GPIO_GID": "997", "DOCKER_GID": "0"})

        self.assertIn("CUSTOM: true", self.agent.COMPOSE_OVERRIDE_FILE.read_text(encoding="utf-8"))

    def test_gpio_status_reports_user_managed_override_blockage(self):
        self.agent.ENV_FILE.write_text("ENABLE_GPIO=true\nGPIO_GID=997\nDOCKER_GID=0\n", encoding="utf-8")
        self.agent.COMPOSE_OVERRIDE_FILE.write_text(
            "services:\n"
            "  backend:\n"
            "    devices: []\n",
            encoding="utf-8",
        )
        original_exists = self.agent.Path.exists

        def fake_exists(path):
            if path.as_posix() == "/dev/gpiochip0":
                return True
            return original_exists(path)

        with patch.object(self.agent.Path, "exists", fake_exists):
            status = self.agent.gpio_status()

        self.assertEqual(status["state"], "failed")
        self.assertFalse(status["available"])
        self.assertTrue(status["checks"]["overrideUserManaged"])
        self.assertIn("user-managed", status["reason"])

    def test_apply_gpio_does_not_write_env_before_user_managed_override_error(self):
        self.agent.ENV_FILE.write_text("ENABLE_GPIO=false\nGPIO_GID=997\n", encoding="utf-8")
        self.agent.COMPOSE_OVERRIDE_FILE.write_text(
            "services:\n"
            "  backend:\n"
            "    devices: []\n",
            encoding="utf-8",
        )

        with patch.object(self.agent, "gpio_status", return_value={"state": "disabled", "reason": "disabled"}):
            with self.assertRaisesRegex(ValueError, "user-managed"):
                self.agent.apply_gpio()

        self.assertIn("ENABLE_GPIO=false", self.agent.ENV_FILE.read_text(encoding="utf-8"))

    def test_apply_gpio_is_safe_to_repeat(self):
        self.agent.ENV_FILE.write_text("ENABLE_GPIO=false\nGPIO_GID=997\nDOCKER_GID=0\n", encoding="utf-8")

        with patch.object(self.agent, "gpio_status", return_value={"state": "disabled", "reason": "disabled"}):
            with patch.object(self.agent, "restart_backend", return_value={"ok": True, "scheduled": True}):
                self.agent.apply_gpio()
                self.agent.apply_gpio()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        override_content = self.agent.COMPOSE_OVERRIDE_FILE.read_text(encoding="utf-8")
        self.assertEqual(env_content.count("ENABLE_GPIO="), 1)
        self.assertIn("ENABLE_GPIO=true", env_content)
        self.assertEqual(override_content.count("/dev/gpiochip0:/dev/gpiochip0"), 1)

    def test_apply_gpio_returns_retryable_backend_restart_failure(self):
        self.agent.ENV_FILE.write_text("ENABLE_GPIO=false\nGPIO_GID=997\nDOCKER_GID=0\n", encoding="utf-8")
        restart_failure = {"ok": False, "scheduled": False, "message": "docker was not found on the host"}

        with patch.object(self.agent, "gpio_status", return_value={"state": "failed"}):
            with patch.object(self.agent, "restart_backend", return_value=restart_failure):
                result = self.agent.apply_gpio()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertEqual(result["restart"], restart_failure)
        self.assertIn("ENABLE_GPIO=true", env_content)
        self.assertIn("/dev/gpiochip0:/dev/gpiochip0", self.agent.COMPOSE_OVERRIDE_FILE.read_text(encoding="utf-8"))

    def test_apply_and_disable_mqtt_are_safe_to_repeat(self):
        self.agent.ENV_FILE.write_text("ENABLE_MQTT_BROKER=false\nCOMPOSE_PROFILES=other\n", encoding="utf-8")

        with patch.object(self.agent, "schedule_compose", return_value={"ok": True, "scheduled": True}):
            with patch.object(self.agent, "restart_backend", return_value={"ok": True, "scheduled": True}):
                with patch.object(self.agent, "mqtt_status", return_value={"state": "enabled"}):
                    self.agent.apply_mqtt()
                    self.agent.apply_mqtt()
                    self.agent.disable_mqtt()
                    self.agent.disable_mqtt()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertEqual(env_content.count("ENABLE_MQTT_BROKER="), 1)
        self.assertEqual(env_content.count("COMPOSE_PROFILES="), 1)
        self.assertIn("ENABLE_MQTT_BROKER=false", env_content)
        self.assertIn("COMPOSE_PROFILES=other", env_content)
        self.assertNotIn("mqtt,mqtt", env_content)

    def test_restart_backend_reports_missing_docker(self):
        with patch.object(self.agent.shutil, "which", return_value=None):
            result = self.agent.restart_backend({})

        self.assertEqual(result, {"ok": False, "scheduled": False, "message": "docker was not found on the host"})

    def test_restart_backend_reports_popen_failure(self):
        with patch.object(self.agent.shutil, "which", return_value="/usr/bin/docker"):
            with patch.object(self.agent.subprocess, "Popen", side_effect=OSError("permission denied")):
                result = self.agent.restart_backend({})

        self.assertFalse(result["ok"])
        self.assertFalse(result["scheduled"])
        self.assertIn("Could not schedule backend restart", result["message"])

    def test_restart_backend_forces_recreate(self):
        with patch.object(self.agent.shutil, "which", return_value="/usr/bin/docker"):
            with patch.object(self.agent.subprocess, "Popen") as popen:
                result = self.agent.restart_backend({})

        self.assertTrue(result["ok"])
        command = popen.call_args.args[0][2]
        self.assertIn("up -d --no-deps --force-recreate backend", command)

    def test_schedule_compose_reports_missing_docker(self):
        with patch.object(self.agent.shutil, "which", return_value=None):
            result = self.agent.schedule_compose({}, ["up", "-d", "mqtt"])

        self.assertEqual(result, {"ok": False, "scheduled": False, "message": "docker was not found on the host"})

    def test_schedule_compose_reports_popen_failure(self):
        with patch.object(self.agent.shutil, "which", return_value="/usr/bin/docker"):
            with patch.object(self.agent.subprocess, "Popen", side_effect=OSError("permission denied")):
                result = self.agent.schedule_compose({}, ["up", "-d", "mqtt"])

        self.assertFalse(result["ok"])
        self.assertFalse(result["scheduled"])
        self.assertIn("Could not schedule Docker Compose command", result["message"])

    def test_apply_mqtt_returns_retryable_compose_schedule_failure(self):
        self.agent.ENV_FILE.write_text("ENABLE_MQTT_BROKER=false\nCOMPOSE_PROFILES=other\n", encoding="utf-8")

        with patch.object(self.agent.shutil, "which", return_value="/usr/bin/docker"):
            with patch.object(self.agent.subprocess, "Popen", side_effect=OSError("permission denied")):
                with patch.object(self.agent, "mqtt_status", return_value={"state": "failed"}):
                    result = self.agent.apply_mqtt()

        self.assertEqual(result["restart"]["ok"], False)
        self.assertEqual(result["restart"]["scheduled"], False)
        self.assertIn("Could not schedule Docker Compose command", result["restart"]["message"])
        self.assertIn("ENABLE_MQTT_BROKER=true", self.agent.ENV_FILE.read_text(encoding="utf-8"))

    def test_disable_helper_actions_are_safe_to_repeat(self):
        self.agent.ENV_FILE.write_text("ENABLE_CAMERA=true\nENABLE_SENSORS=true\n", encoding="utf-8")
        self.agent.CAMERA_SERVICE_FILE.write_text("camera service\n", encoding="utf-8")
        self.agent.SENSOR_SERVICE_FILE.write_text("sensor service\n", encoding="utf-8")

        with patch.object(self.agent.shutil, "which", return_value="/bin/systemctl"):
            with patch.object(self.agent, "run", return_value=None):
                with patch.object(self.agent, "restart_backend", return_value={"ok": True, "scheduled": True}):
                    with patch.object(self.agent, "camera_status", return_value={"state": "disabled"}):
                        with patch.object(self.agent, "sensor_status", return_value={"state": "disabled"}):
                            self.agent.disable_camera()
                            self.agent.disable_camera()
                            self.agent.disable_sensors()
                            self.agent.disable_sensors()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertIn("ENABLE_CAMERA=false", env_content)
        self.assertIn("ENABLE_SENSORS=false", env_content)
        self.assertFalse(self.agent.CAMERA_SERVICE_FILE.exists())
        self.assertFalse(self.agent.SENSOR_SERVICE_FILE.exists())

    def test_apply_camera_is_safe_to_repeat(self):
        self.agent.ENV_FILE.write_text(
            "ENABLE_CAMERA=false\n"
            "CAMERA_HELPER_TOKEN=existing-camera-token\n"
            "CAMERA_HELPER_PORT=38180\n"
            "CAMERA_CAPTURE_DIR=/data/captures\n",
            encoding="utf-8",
        )

        with patch.object(self.agent, "missing_camera_tools_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", return_value=self.agent.subprocess.CompletedProcess([], 0, "", "")):
                    with patch.object(self.agent, "restart_backend", return_value={"ok": True, "scheduled": True}):
                        with patch.object(self.agent, "camera_status", return_value={"state": "enabled"}):
                            self.agent.apply_camera()
                            self.agent.apply_camera()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        service_content = self.agent.CAMERA_SERVICE_FILE.read_text(encoding="utf-8")
        self.assertEqual(env_content.count("ENABLE_CAMERA="), 1)
        self.assertEqual(env_content.count("CAMERA_HELPER_TOKEN="), 1)
        self.assertIn("ENABLE_CAMERA=true", env_content)
        self.assertIn("CAMERA_HELPER_TOKEN=existing-camera-token", env_content)
        self.assertIn("Environment=CAMERA_HELPER_TOKEN=existing-camera-token", service_content)

    def test_apply_camera_returns_retryable_backend_restart_failure(self):
        self.agent.ENV_FILE.write_text(
            "ENABLE_CAMERA=false\n"
            "CAMERA_HELPER_TOKEN=existing-camera-token\n"
            "CAMERA_HELPER_PORT=38180\n"
            "CAMERA_CAPTURE_DIR=/data/captures\n",
            encoding="utf-8",
        )
        restart_failure = {"ok": False, "scheduled": False, "message": "docker was not found on the host"}

        with patch.object(self.agent, "missing_camera_tools_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", return_value=self.agent.subprocess.CompletedProcess([], 0, "", "")):
                    with patch.object(self.agent, "restart_backend", return_value=restart_failure):
                        with patch.object(self.agent, "camera_status", return_value={"state": "failed"}):
                            result = self.agent.apply_camera()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertEqual(result["restart"], restart_failure)
        self.assertIn("ENABLE_CAMERA=true", env_content)
        self.assertTrue(self.agent.CAMERA_SERVICE_FILE.exists())

    def test_apply_sensors_is_safe_to_repeat(self):
        self.agent.ENV_FILE.write_text(
            "ENABLE_SENSORS=false\n"
            "SENSOR_HELPER_TOKEN=existing-sensor-token\n"
            "SENSOR_HELPER_PORT=38181\n",
            encoding="utf-8",
        )
        sensor_python = self.root / ".venv-sensor-helper" / "bin" / "python"
        sensor_python.parent.mkdir(parents=True)
        sensor_python.write_text("", encoding="utf-8")

        with patch.object(self.agent, "missing_sensor_prerequisites_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", return_value=self.agent.subprocess.CompletedProcess([], 0, "", "")):
                    with patch.object(self.agent, "restart_backend", return_value={"ok": True, "scheduled": True}):
                        with patch.object(self.agent, "sensor_status", return_value={"state": "enabled"}):
                            self.agent.apply_sensors()
                            self.agent.apply_sensors()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        service_content = self.agent.SENSOR_SERVICE_FILE.read_text(encoding="utf-8")
        self.assertEqual(env_content.count("ENABLE_SENSORS="), 1)
        self.assertEqual(env_content.count("SENSOR_HELPER_TOKEN="), 1)
        self.assertIn("ENABLE_SENSORS=true", env_content)
        self.assertIn("SENSOR_HELPER_TOKEN=existing-sensor-token", env_content)
        self.assertIn("Environment=SENSOR_HELPER_TOKEN=existing-sensor-token", service_content)

    def test_apply_sensors_returns_retryable_backend_restart_failure(self):
        self.agent.ENV_FILE.write_text(
            "ENABLE_SENSORS=false\n"
            "SENSOR_HELPER_TOKEN=existing-sensor-token\n"
            "SENSOR_HELPER_PORT=38181\n",
            encoding="utf-8",
        )
        sensor_python = self.root / ".venv-sensor-helper" / "bin" / "python"
        sensor_python.parent.mkdir(parents=True)
        sensor_python.write_text("", encoding="utf-8")
        restart_failure = {"ok": False, "scheduled": False, "message": "docker was not found on the host"}

        with patch.object(self.agent, "missing_sensor_prerequisites_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", return_value=self.agent.subprocess.CompletedProcess([], 0, "", "")):
                    with patch.object(self.agent, "restart_backend", return_value=restart_failure):
                        with patch.object(self.agent, "sensor_status", return_value={"state": "failed"}):
                            result = self.agent.apply_sensors()

        env_content = self.agent.ENV_FILE.read_text(encoding="utf-8")
        self.assertEqual(result["restart"], restart_failure)
        self.assertIn("ENABLE_SENSORS=true", env_content)
        self.assertTrue(self.agent.SENSOR_SERVICE_FILE.exists())

    def test_sensor_status_reports_missing_i2c_before_enable(self):
        self.agent.ENV_FILE.write_text("ENABLE_SENSORS=false\n", encoding="utf-8")
        original_exists = self.agent.Path.exists

        def fake_exists(path):
            if path.as_posix() == "/dev/i2c-1":
                return False
            return original_exists(path)

        with patch.object(self.agent.Path, "exists", fake_exists):
            with patch.object(self.agent.shutil, "which", return_value="/usr/bin/python3"):
                with patch.object(self.agent, "run", return_value=self.agent.subprocess.CompletedProcess([], 0, "", "")):
                    status = self.agent.sensor_status()

        self.assertEqual(status["state"], "missing_prerequisites")
        self.assertFalse(status["enabled"])
        self.assertFalse(status["available"])
        self.assertIn("/dev/i2c-1 was not found", status["reason"])

    def test_setup_sensor_prerequisites_runs_fixed_i2c_steps(self):
        original_exists = self.agent.Path.exists
        commands = []

        def fake_exists(path):
            if path.as_posix() == "/dev/i2c-1":
                return True
            return original_exists(path)

        def fake_run(command, **_kwargs):
            commands.append(command)
            return self.agent.subprocess.CompletedProcess(command, 0, "", "")

        with patch.object(self.agent.shutil, "which", return_value="/usr/bin/tool"):
            with patch.object(self.agent.Path, "exists", fake_exists):
                with patch.object(self.agent, "run", side_effect=fake_run):
                    with patch.object(self.agent, "sensor_status", return_value={"name": "sensors", "state": "disabled"}):
                        result = self.agent.setup_sensor_prerequisites()

        self.assertEqual(commands, [
            ["apt-get", "update"],
            ["apt-get", "install", "-y", "python3-smbus", "i2c-tools"],
            ["raspi-config", "nonint", "do_i2c", "0"],
        ])
        self.assertFalse(result["rebootRequired"])
        self.assertEqual(result["steps"][-1], {"label": "Check /dev/i2c-1", "ok": True})

    def test_apply_camera_systemd_failure_does_not_enable_env(self):
        self.agent.ENV_FILE.write_text("ENABLE_CAMERA=false\nCAMERA_HELPER_TOKEN=token\n", encoding="utf-8")

        def fail_on_restart(command, check=True, timeout=None):
            if command[:2] == ["systemctl", "restart"]:
                raise RuntimeError("restart failed")
            return self.agent.subprocess.CompletedProcess(command, 0, "", "")

        with patch.object(self.agent, "missing_camera_tools_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", side_effect=fail_on_restart):
                    with self.assertRaisesRegex(RuntimeError, "restart failed"):
                        self.agent.apply_camera()

        self.assertIn("ENABLE_CAMERA=false", self.agent.ENV_FILE.read_text(encoding="utf-8"))
        self.assertTrue(self.agent.CAMERA_SERVICE_FILE.exists())

    def test_apply_sensors_systemd_failure_does_not_enable_env(self):
        self.agent.ENV_FILE.write_text("ENABLE_SENSORS=false\nSENSOR_HELPER_TOKEN=token\n", encoding="utf-8")
        sensor_python = self.root / ".venv-sensor-helper" / "bin" / "python"
        sensor_python.parent.mkdir(parents=True)
        sensor_python.write_text("", encoding="utf-8")

        def fail_on_restart(command, check=True, timeout=None):
            if command[:2] == ["systemctl", "restart"]:
                raise RuntimeError("restart failed")
            return self.agent.subprocess.CompletedProcess(command, 0, "", "")

        with patch.object(self.agent, "missing_sensor_prerequisites_message", return_value=None):
            with patch.object(self.agent, "helper_user", return_value="root"):
                with patch.object(self.agent, "run", side_effect=fail_on_restart):
                    with self.assertRaisesRegex(RuntimeError, "restart failed"):
                        self.agent.apply_sensors()

        self.assertIn("ENABLE_SENSORS=false", self.agent.ENV_FILE.read_text(encoding="utf-8"))
        self.assertTrue(self.agent.SENSOR_SERVICE_FILE.exists())

    def test_unlink_if_exists_is_safe_when_file_is_already_missing(self):
        missing = self.root / "missing.service"

        self.agent.unlink_if_exists(missing)

        self.assertFalse(missing.exists())

    def test_apply_host_runtime_update_replaces_allowlisted_files(self):
        artifact = host_runtime_artifact({path: f"updated {path}\n" for path in self.agent.HOST_RUNTIME_FILES})

        with patch.object(self.agent, "restart_systemd_service", return_value={"ok": True, "scheduled": True}):
            result = self.agent.apply_host_runtime_update(artifact)

        self.assertTrue(result["updated"])
        self.assertEqual(set(result["changed"]), set(self.agent.HOST_RUNTIME_FILES))
        for path in self.agent.HOST_RUNTIME_FILES:
            self.assertEqual((self.root / path).read_text(encoding="utf-8"), f"updated {path}\n")

    def test_apply_host_runtime_update_rejects_missing_required_file(self):
        files = {path: f"updated {path}\n" for path in self.agent.HOST_RUNTIME_FILES}
        del files["host-agent/edge_studio_host_agent.py"]

        with self.assertRaisesRegex(ValueError, "missing required files"):
            self.agent.apply_host_runtime_update(host_runtime_artifact(files))

    def test_apply_host_runtime_update_rejects_unsafe_path(self):
        files = {path: f"updated {path}\n" for path in self.agent.HOST_RUNTIME_FILES}
        files["../escape.py"] = "bad"

        with self.assertRaisesRegex(ValueError, "unsafe path"):
            self.agent.apply_host_runtime_update(host_runtime_artifact(files))

    def test_apply_host_runtime_update_restarts_changed_enabled_helpers(self):
        files = {path: f"updated {path}\n" for path in self.agent.HOST_RUNTIME_FILES}
        for path, content in files.items():
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode("utf-8"))
        changed_camera = "camera-helper/edge_studio_camera_helper.py"
        files[changed_camera] = "changed camera helper\n"
        self.agent.ENV_FILE.write_text("ENABLE_CAMERA=true\nENABLE_SENSORS=false\nENABLE_MQTT_BROKER=false\n", encoding="utf-8")

        with patch.object(self.agent, "restart_systemd_service", return_value={"service": "edge-studio-camera-helper.service", "ok": True, "scheduled": False}) as restart:
            result = self.agent.apply_host_runtime_update(host_runtime_artifact(files))

        self.assertEqual(result["changed"], [changed_camera])
        restart.assert_called_once_with("edge-studio-camera-helper.service")

    def test_apply_host_runtime_update_retries_restarts_when_files_are_current(self):
        files = {path: f"updated {path}\n" for path in self.agent.HOST_RUNTIME_FILES}
        for path, content in files.items():
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode("utf-8"))
        self.agent.ENV_FILE.write_text("ENABLE_CAMERA=true\nENABLE_SENSORS=false\nENABLE_MQTT_BROKER=false\n", encoding="utf-8")

        with patch.object(self.agent, "restart_systemd_service", return_value={"service": "edge-studio-camera-helper.service", "ok": True, "scheduled": False}) as restart:
            result = self.agent.apply_host_runtime_update(host_runtime_artifact(files))

        self.assertFalse(result["updated"])
        self.assertEqual(result["changed"], [])
        restart.assert_any_call("edge-studio-camera-helper.service")


if __name__ == "__main__":
    unittest.main()
