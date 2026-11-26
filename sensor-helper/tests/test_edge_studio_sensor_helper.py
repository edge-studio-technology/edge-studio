import importlib.util
import sys
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


HELPER_PATH = Path(__file__).resolve().parents[1] / "edge_studio_sensor_helper.py"
spec = importlib.util.spec_from_file_location("sensor_helper", HELPER_PATH)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class Bh1750Tests(unittest.TestCase):
    def setUp(self):
        self.bus = MagicMock()
        self.smbus2 = types.ModuleType("smbus2")
        self.smbus2.SMBus = MagicMock()
        self.smbus2.SMBus.return_value.__enter__.return_value = self.bus
        self.smbus2.i2c_msg = MagicMock()

    def test_conversion_reads_two_raw_bytes_after_conversion_without_register_write(self):
        for data, expected in [([0, 0], 0), ([1, 32], 240), ([255, 255], 54612.5)]:
            with self.subTest(data=data), patch.dict(sys.modules, {"smbus2": self.smbus2}), patch.object(helper.time, "sleep") as sleep:
                self.smbus2.i2c_msg.read.return_value = data
                events = []
                self.bus.write_byte.side_effect = lambda *args: events.append(("write", args))
                sleep.side_effect = lambda seconds: events.append(("sleep", seconds))
                self.bus.i2c_rdwr.side_effect = lambda message: events.append(("read", message))
                result = helper.SensorHelper("token").read({"sensor": "bh1750", "bus": 1, "address": "0x5c"})
                self.assertEqual(result["lux"], expected)
                self.assertEqual(result["sensor"], "bh1750")
                self.assertEqual(result["address"], "0x5c")
                self.assertEqual(result["bus"], 1)
                self.assertRegex(result["readAt"], r"^\d{4}-\d{2}-\d{2}T.*Z$")
                self.assertEqual(events, [*(('write', (0x5c, command)) for command in (0x01, 0x07, 0x42, 0x65, 0x20)), ("sleep", 0.180), ("read", data)])
                self.smbus2.i2c_msg.read.assert_called_with(0x5c, 2)
                self.bus.read_i2c_block_data.assert_not_called()

    def test_bus_is_closed_on_io_failure_and_failure_is_not_a_zero_reading(self):
        self.bus.write_byte.side_effect = OSError("sensor disconnected")
        with patch.dict(sys.modules, {"smbus2": self.smbus2}):
            with self.assertRaisesRegex(OSError, "sensor disconnected"):
                helper.read_bh1750(1, 0x23)
        self.smbus2.SMBus.return_value.__exit__.assert_called_once()

    def test_missing_dependency_reports_repair_and_does_not_claim_capability(self):
        with patch.dict(sys.modules, {"smbus2": None}), patch.object(helper, "load_smbus", return_value=object()), patch.object(helper.Path, "exists", return_value=True):
            with self.assertRaisesRegex(RuntimeError, "Repair I2C sensors"):
                helper.read_bh1750(1, 0x23)
            self.assertNotIn("bh1750", helper.SensorHelper("token").capabilities()["supportedSensors"])

    def test_capability_reports_driver_support_without_claiming_connected_hardware(self):
        with patch.dict(sys.modules, {"smbus2": self.smbus2}), patch.object(helper.Path, "exists", return_value=False):
            capability = helper.SensorHelper("token").capabilities()
        self.assertIn("bh1750", capability["supportedSensors"])
        self.assertFalse(capability["available"])

    def test_invalid_model_address_and_bus_are_rejected_before_io(self):
        for config in [{"sensor": "unknown"}, {"sensor": "bh1750", "address": "0x76"}, *({"sensor": "bh1750", "bus": bus} for bus in (11, 1.5, True))]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                helper.SensorHelper("token").read(config)
        self.smbus2.SMBus.assert_not_called()

    def test_concurrent_reads_of_the_sensor_are_serialized(self):
        sensor = helper.SensorHelper("token")
        entered = threading.Event()
        release = threading.Event()
        second_started = threading.Event()
        active = []
        overlaps = []

        def read(*args):
            if active:
                overlaps.append(True)
            active.append(True)
            entered.set()
            release.wait(2)
            active.pop()

        def second_read():
            second_started.set()
            sensor.read({"sensor": "bh1750"})

        with patch.object(helper, "read_bh1750", side_effect=read) as mocked:
            first = threading.Thread(target=lambda: sensor.read({"sensor": "bh1750"}))
            second = threading.Thread(target=second_read)
            first.start()
            self.assertTrue(entered.wait(2))
            second.start()
            self.assertTrue(second_started.wait(2))
            release.set()
            first.join(2)
            second.join(2)
        self.assertEqual(mocked.call_count, 2)
        self.assertEqual(overlaps, [])


if __name__ == "__main__":
    unittest.main()
