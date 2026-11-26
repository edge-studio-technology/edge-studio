import http.client
import importlib.util
import json
import sys
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from PIL import Image


spec = importlib.util.spec_from_file_location("display_helper", Path(__file__).resolve().parents[1] / "edge_studio_display_helper.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class DisplayTests(unittest.TestCase):
    def setUp(self):
        self.driver = types.ModuleType("st7789")
        self.driver.ST7789 = MagicMock()
        self.modules = patch.dict(sys.modules, {"st7789": self.driver})
        self.modules.start()
        self.addCleanup(self.modules.stop)

    def test_real_pillow_rendering_wraps_and_draws_text_in_rgb(self):
        image = helper.render_text("Status", "Hello from a workflow")
        self.assertEqual(image.size, (240, 240))
        self.assertEqual(image.mode, "RGB")
        self.assertEqual(image.getpixel((0, 0)), (0, 0, 0))
        self.assertIsNotNone(image.crop((12, 12, 228, 40)).getbbox())
        self.assertIsNotNone(image.crop((12, 48, 228, 220)).getbbox())
        self.assertEqual(helper.render_text("", "LongWord" * 5).size, (240, 240))
        with self.assertRaisesRegex(ValueError, "does not fit"):
            helper.render_text("Status", "word " * 100)
        with self.assertRaisesRegex(ValueError, "too wide"):
            helper.render_text("W" * 32, "Text")

    def test_text_write_recovers_cached_controller_and_spi_state_without_reallocating_gpio(self):
        display = helper.DisplayHelper()
        panel = self.driver.ST7789.return_value
        display.display = panel
        panel._spi.mode = 3
        panel._spi.lsbfirst = True
        panel._spi.max_speed_hz = 1000000

        display.update({"config": {"model": "pim576"}, "content": {"text": "Recovered"}})

        self.assertEqual((panel._spi.mode, panel._spi.lsbfirst, panel._spi.max_speed_hz), (0, False, 16000000))
        panel._init.assert_called_once_with()
        panel.set_backlight.assert_called_once_with(True)
        panel.display.assert_called_once()
        self.driver.ST7789.assert_not_called()

    def test_lazy_driver_is_reused_and_shutdown_turns_backlight_off(self):
        display = helper.DisplayHelper()
        self.driver.ST7789.assert_not_called()
        for rotation in (0, 90, 180, 270):
            result = display.update({"config": {"model": "pim576", "rotation": rotation}, "content": {"text": "Custom variable", "title": "Edge Studio"}})
            self.assertEqual(result["text"], "Custom variable")
            self.assertEqual(result["rotation"], rotation)
        self.driver.ST7789.assert_called_once_with(port=0, cs=0, dc=25, backlight=24, width=240, height=240, rotation=0, spi_speed_hz=16000000, offset_left=0, offset_top=0)
        self.assertEqual(self.driver.ST7789.return_value.display.call_count, 4)
        self.assertEqual(self.driver.ST7789.return_value._init.call_count, 3)
        display.close()
        self.assertEqual([call.args[0] for call in self.driver.ST7789.return_value.set_backlight.call_args_list], [True, True, True, False])

    def test_invalid_requests_do_not_initialize_or_write_hardware(self):
        display = helper.DisplayHelper()
        for payload in [[], {}, {"config": {"model": "other"}}, {"config": {"model": "pim576", "rotation": True}, "content": {"text": "Hi"}}, {"config": {"model": "pim576"}, "content": {"text": " "}}]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                display.update(payload)
        with self.assertRaisesRegex(ValueError, "does not fit"):
            display.update({"config": {"model": "pim576"}, "content": {"text": "Hi\n" * 30}})
        self.driver.ST7789.assert_not_called()

    def test_capabilities_do_not_claim_a_physical_screen_is_detected(self):
        with patch.object(helper.Path, "exists", return_value=True):
            self.assertTrue(helper.DisplayHelper().capabilities()["available"])
        self.driver.ST7789.assert_not_called()
        with patch.object(helper.Path, "exists", return_value=False):
            self.assertIn("Enable SPI", helper.DisplayHelper().capabilities()["reason"])
        with patch.object(helper, "display_modules", side_effect=ImportError()):
            self.assertIn("Repair", helper.DisplayHelper().capabilities()["reason"])

    def test_hardware_failure_does_not_become_a_successful_update(self):
        self.driver.ST7789.return_value.display.side_effect = OSError("SPI failed")
        with self.assertRaisesRegex(OSError, "SPI failed"):
            helper.DisplayHelper().update({"config": {"model": "pim576"}, "content": {"text": "Hi"}})

    def test_rotation_is_applied_to_the_image_without_reallocating_gpio(self):
        original = Image.new("RGB", (240, 240), "black")
        original.putpixel((12, 20), (255, 0, 0))
        with patch.object(helper, "render_text", return_value=original):
            helper.DisplayHelper().update({"config": {"model": "pim576", "rotation": 90}, "content": {"text": "Hi"}})
        sent = self.driver.ST7789.return_value.display.call_args.args[0]
        self.assertEqual(sent.tobytes(), original.rotate(90).tobytes())

    def test_auth_route_and_size_validation_at_real_http_boundary(self):
        class Handler(helper.Handler):
            token = "test-display-token"
            helper = MagicMock()
        Handler.helper.update.return_value = {"text": "Hi"}
        server = helper.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)

        def request(path, body, token=None):
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port)
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            connection.request("POST", path, body=body, headers=headers)
            response = connection.getresponse()
            data = json.loads(response.read())
            connection.close()
            return response.status, data

        self.assertEqual(request("/display", "{}")[0], 401)
        self.assertEqual(request("/shell", "{}", Handler.token)[0], 404)
        self.assertEqual(request("/display", "x" * 4097, Handler.token)[0], 400)
        self.assertEqual(request("/display", "not json", Handler.token)[0], 400)
        Handler.helper.update.assert_not_called()
        self.assertEqual(request("/display", "{}", Handler.token), (200, {"text": "Hi"}))
        Handler.helper.update.side_effect = OSError("private native details")
        status, data = request("/display", "{}", Handler.token)
        self.assertEqual(status, 503)
        self.assertNotIn("private", data["error"])


if __name__ == "__main__":
    unittest.main()
