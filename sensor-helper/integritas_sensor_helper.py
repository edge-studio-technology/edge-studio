#!/usr/bin/env python3
import argparse
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def load_smbus():
    try:
        from smbus2 import SMBus
        return SMBus
    except Exception:
        try:
            from smbus import SMBus
            return SMBus
        except Exception:
            return None


def load_bme680():
    try:
        import bme680
        return bme680
    except Exception:
        return None


class SensorHelper:
    def __init__(self, token):
        self.token = token

    def capabilities(self):
        SMBus = load_smbus()
        supported_sensors = ["bme280"]
        if load_bme680() is not None:
            supported_sensors.append("bme680")
        if SMBus is None:
            return {"available": False, "reason": "Python smbus2 or smbus module was not found. Install python3-smbus or python3-smbus2 on the host.", "supportedSensors": supported_sensors}
        if not Path("/dev/i2c-1").exists():
            return {"available": False, "reason": "/dev/i2c-1 was not found. Enable I2C on the Raspberry Pi and reboot if needed.", "supportedSensors": supported_sensors}
        return {"available": True, "reason": None, "supportedSensors": supported_sensors}

    def read(self, payload):
        sensor = str(payload.get("sensor", "bme280")).lower()
        if sensor not in ("bme280", "bme680"):
            raise ValueError("Unsupported sensor type")
        bus = parse_int(payload.get("bus", 1), "bus", 0, 10)
        address = parse_address(payload.get("address", "0x76"))
        if sensor == "bme680":
            return read_bme680(bus, address)
        return read_bme280(bus, address)


def parse_int(value, name, minimum, maximum):
    try:
        parsed = int(value)
    except Exception:
        raise ValueError(f"{name} must be an integer")
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def parse_address(value):
    text = str(value).strip().lower()
    if text not in ("0x76", "0x77"):
        raise ValueError("address must be 0x76 or 0x77")
    return int(text, 16)


def read_bme280(bus_number, address):
    SMBus = load_smbus()
    if SMBus is None:
        raise RuntimeError("Python smbus2 or smbus module was not found")

    bus = SMBus(bus_number)
    try:
        chip_id = bus.read_byte_data(address, 0xD0)
        if chip_id != 0x60:
            raise RuntimeError(f"Device at 0x{address:02x} did not report BME280 chip id 0x60")

        calib = read_calibration(bus, address)
        bus.write_byte_data(address, 0xF2, 0x01)  # humidity oversampling x1
        bus.write_byte_data(address, 0xF4, 0x27)  # normal mode, temp/pressure oversampling x1
        bus.write_byte_data(address, 0xF5, 0xA0)  # standby 1000ms
        time.sleep(0.05)

        data = bus.read_i2c_block_data(address, 0xF7, 8)
    finally:
        close = getattr(bus, "close", None)
        if callable(close):
            close()

    adc_p = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
    adc_t = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
    adc_h = (data[6] << 8) | data[7]
    temperature_c, t_fine = compensate_temperature(adc_t, calib)
    pressure_hpa = compensate_pressure(adc_p, calib, t_fine)
    humidity_percent = compensate_humidity(adc_h, calib, t_fine)

    return {
        "sensor": "bme280",
        "bus": bus_number,
        "address": f"0x{address:02x}",
        "temperatureC": round(temperature_c, 2),
        "humidityPercent": round(humidity_percent, 2),
        "pressureHpa": round(pressure_hpa, 2),
        "readAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def read_bme680(bus_number, address):
    bme680 = load_bme680()
    if bme680 is None:
        raise RuntimeError("Python bme680 module was not found. Install python3-bme680 on the host.")

    SMBus = load_smbus()
    if SMBus is None:
        raise RuntimeError("Python smbus2 or smbus module was not found")

    bus = SMBus(bus_number)
    try:
        sensor = bme680.BME680(i2c_addr=address, i2c_device=bus)
        sensor.set_humidity_oversample(bme680.OS_2X)
        sensor.set_pressure_oversample(bme680.OS_4X)
        sensor.set_temperature_oversample(bme680.OS_8X)
        sensor.set_filter(bme680.FILTER_SIZE_3)
        sensor.set_gas_status(bme680.DISABLE_GAS_MEAS)
        if not sensor.get_sensor_data():
            raise RuntimeError(f"Device at 0x{address:02x} did not return BME680 data")

        return {
            "sensor": "bme680",
            "bus": bus_number,
            "address": f"0x{address:02x}",
            "temperatureC": round(sensor.data.temperature, 2),
            "humidityPercent": round(sensor.data.humidity, 2),
            "pressureHpa": round(sensor.data.pressure, 2),
            "readAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    finally:
        close = getattr(bus, "close", None)
        if callable(close):
            close()


def read_calibration(bus, address):
    block1 = bus.read_i2c_block_data(address, 0x88, 26)
    block2 = bus.read_i2c_block_data(address, 0xE1, 7)
    return {
        "dig_T1": u16(block1, 0), "dig_T2": s16(block1, 2), "dig_T3": s16(block1, 4),
        "dig_P1": u16(block1, 6), "dig_P2": s16(block1, 8), "dig_P3": s16(block1, 10), "dig_P4": s16(block1, 12), "dig_P5": s16(block1, 14), "dig_P6": s16(block1, 16), "dig_P7": s16(block1, 18), "dig_P8": s16(block1, 20), "dig_P9": s16(block1, 22),
        "dig_H1": block1[25], "dig_H2": s16(block2, 0), "dig_H3": block2[2], "dig_H4": sign_extend((block2[3] << 4) | (block2[4] & 0x0F), 12), "dig_H5": sign_extend((block2[5] << 4) | (block2[4] >> 4), 12), "dig_H6": sign_extend(block2[6], 8),
    }


def u16(data, index):
    return data[index] | (data[index + 1] << 8)


def s16(data, index):
    value = u16(data, index)
    return value - 65536 if value & 0x8000 else value


def sign_extend(value, bits):
    sign_bit = 1 << (bits - 1)
    return (value & (sign_bit - 1)) - (value & sign_bit)


def compensate_temperature(adc_t, calib):
    var1 = (((adc_t >> 3) - (calib["dig_T1"] << 1)) * calib["dig_T2"]) >> 11
    var2 = (((((adc_t >> 4) - calib["dig_T1"]) * ((adc_t >> 4) - calib["dig_T1"])) >> 12) * calib["dig_T3"]) >> 14
    t_fine = var1 + var2
    return ((t_fine * 5 + 128) >> 8) / 100.0, t_fine


def compensate_pressure(adc_p, calib, t_fine):
    var1 = t_fine - 128000
    var2 = var1 * var1 * calib["dig_P6"]
    var2 = var2 + ((var1 * calib["dig_P5"]) << 17)
    var2 = var2 + (calib["dig_P4"] << 35)
    var1 = ((var1 * var1 * calib["dig_P3"]) >> 8) + ((var1 * calib["dig_P2"]) << 12)
    var1 = ((((1 << 47) + var1)) * calib["dig_P1"]) >> 33
    if var1 == 0:
        return 0
    pressure = 1048576 - adc_p
    pressure = (((pressure << 31) - var2) * 3125) // var1
    var1 = (calib["dig_P9"] * (pressure >> 13) * (pressure >> 13)) >> 25
    var2 = (calib["dig_P8"] * pressure) >> 19
    pressure = ((pressure + var1 + var2) >> 8) + (calib["dig_P7"] << 4)
    return pressure / 25600.0


def compensate_humidity(adc_h, calib, t_fine):
    value = t_fine - 76800
    value = (((((adc_h << 14) - (calib["dig_H4"] << 20) - (calib["dig_H5"] * value)) + 16384) >> 15) * (((((((value * calib["dig_H6"]) >> 10) * (((value * calib["dig_H3"]) >> 11) + 32768)) >> 10) + 2097152) * calib["dig_H2"] + 8192) >> 14))
    value = value - (((((value >> 15) * (value >> 15)) >> 7) * calib["dig_H1"]) >> 4)
    value = max(0, min(value, 419430400))
    return (value >> 12) / 1024.0


class Handler(BaseHTTPRequestHandler):
    helper = None

    def log_message(self, format, *args):
        return

    def authenticated(self):
        expected = self.helper.token
        if not expected:
            return True
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {expected}"

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/health":
            return json_response(self, 200, {"ok": True})
        if route == "/capabilities":
            if not self.authenticated():
                return json_response(self, 401, {"error": "Unauthorized"})
            return json_response(self, 200, self.helper.capabilities())
        return json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        route = urlparse(self.path).path
        if route != "/read":
            return json_response(self, 404, {"error": "Not found"})
        if not self.authenticated():
            return json_response(self, 401, {"error": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8192:
                return json_response(self, 413, {"error": "Request body too large"})
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            return json_response(self, 200, self.helper.read(payload))
        except Exception as exc:
            return json_response(self, 400, {"error": str(exc)})


def main():
    parser = argparse.ArgumentParser(description="Edge Studio sensor helper")
    parser.add_argument("--host", default=os.environ.get("SENSOR_HELPER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("SENSOR_HELPER_PORT", "38181")))
    parser.add_argument("--token", default=os.environ.get("SENSOR_HELPER_TOKEN", ""))
    args = parser.parse_args()

    Handler.helper = SensorHelper(args.token)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
