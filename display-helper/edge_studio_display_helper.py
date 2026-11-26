#!/usr/bin/env python3
import hmac
import json
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def display_modules():
    import st7789
    from PIL import Image, ImageDraw, ImageFont
    return st7789, Image, ImageDraw, ImageFont


def validate_display(payload):
    if not isinstance(payload, dict):
        raise ValueError("Display request must be an object")
    config = payload.get("config")
    content = payload.get("content")
    if not isinstance(config, dict) or config.get("model") != "pim576":
        raise ValueError("config.model must be pim576")
    rotation = config.get("rotation", 0)
    if type(rotation) is not int or rotation not in (0, 90, 180, 270):
        raise ValueError("config.rotation must be 0, 90, 180 or 270")
    if not isinstance(content, dict):
        raise ValueError("Display content must be an object with text and optional title")
    text = content.get("text")
    title = content.get("title", "")
    if not isinstance(text, str) or not text.strip() or len(text) > 512:
        raise ValueError("Display text must contain 1 to 512 characters")
    if not isinstance(title, str) or len(title) > 32 or "\n" in title or "\r" in title:
        raise ValueError("Display title must be a single line of at most 32 characters")
    return rotation, title, text


def render_text(title, text):
    _, Image, ImageDraw, ImageFont = display_modules()
    image = Image.new("RGB", (240, 240), "black")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=20)
    y = 12
    if title:
        if draw.textlength(title, font=font) > 216:
            raise ValueError("Display title is too wide; shorten it")
        draw.text((12, y), title, font=font, fill="white")
        y += 36
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for character in paragraph:
            if draw.textlength(line + character, font=font) > 216:
                lines.append(line)
                line = ""
            line += character
        lines.append(line)
    if y + len(lines) * 24 > 228:
        raise ValueError("Display text does not fit the screen; shorten it or use fewer lines")
    for line in lines:
        draw.text((12, y), line, font=font, fill="white")
        y += 24
    return image


class DisplayHelper:
    def __init__(self):
        self.lock = threading.Lock()
        self.display = None

    def capabilities(self):
        try:
            display_modules()
        except ImportError:
            return {"available": False, "reason": "Display dependencies are missing. Repair SPI displays in Hardware support."}
        if not Path("/dev/spidev0.0").exists():
            return {"available": False, "reason": "/dev/spidev0.0 is missing. Enable SPI on the Pi and reboot if needed."}
        return {"available": True, "reason": None, "supportedModels": ["pim576"]}

    def write_image(self, image):
        if self.display is None:
            st7789, _, _, _ = display_modules()
            self.display = st7789.ST7789(port=0, cs=0, dc=25, backlight=24,
                                        width=240, height=240, rotation=0,
                                        spi_speed_hz=16000000, offset_left=0, offset_top=0)
        else:
            # ST7789 1.0.1 exposes these attributes; restore state after other SPI users.
            self.display._spi.mode = 0
            self.display._spi.lsbfirst = False
            self.display._spi.max_speed_hz = 16000000
            self.display._init()
            self.display.set_backlight(True)
        self.display.display(image)

    def update(self, payload):
        rotation, title, text = validate_display(payload)
        image = render_text(title, text).rotate(rotation)
        with self.lock:
            self.write_image(image)
        return {"model": "pim576", "rotation": rotation, "title": title, "text": text}

    def close(self):
        with self.lock:
            if self.display is not None:
                self.display.set_backlight(False)


class Handler(BaseHTTPRequestHandler):
    helper = None
    token = ""

    def log_message(self, *_args):
        return

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return bool(self.token) and hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {self.token}")

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        if self.path == "/capabilities":
            return self.send_json(200, self.helper.capabilities())
        return self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(401, {"error": "Unauthorized"})
        if self.path != "/display":
            return self.send_json(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                return self.send_json(400, {"error": "Display request must contain 1 to 4096 bytes"})
            payload = json.loads(self.rfile.read(length))
            return self.send_json(200, self.helper.update(payload))
        except (ValueError, UnicodeError) as error:
            return self.send_json(400, {"error": str(error)})
        except Exception:
            return self.send_json(503, {"error": "SPI display update failed. Check Hardware support, wiring, SPI access and GPIO pin ownership."})


def main():
    Handler.token = os.environ.get("DISPLAY_HELPER_TOKEN", "")
    if not Handler.token:
        raise SystemExit("DISPLAY_HELPER_TOKEN is required")
    Handler.helper = DisplayHelper()
    server = ThreadingHTTPServer((os.environ.get("DISPLAY_HELPER_HOST", "0.0.0.0"), int(os.environ.get("DISPLAY_HELPER_PORT", "38183"))), Handler)
    def stop(_signal, _frame):
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        Handler.helper.close()


if __name__ == "__main__":
    main()
