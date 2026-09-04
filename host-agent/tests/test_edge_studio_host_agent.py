import importlib.util
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


class HostAgentWriteTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.agent = load_agent()
        self.agent.APP_DIR = self.root
        self.agent.ENV_FILE = self.root / ".env"
        self.agent.COMPOSE_OVERRIDE_FILE = self.root / "docker-compose.override.yml"

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

    def test_unlink_if_exists_is_safe_when_file_is_already_missing(self):
        missing = self.root / "missing.service"

        self.agent.unlink_if_exists(missing)

        self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
