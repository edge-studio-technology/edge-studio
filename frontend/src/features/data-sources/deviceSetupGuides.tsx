import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { MutedText } from "../../components/Text";
import type { DataSource } from "./dataSourceTypes";

type GuideSection = { title: string; body?: string; items?: string[]; table?: Array<[string, string]>; commands?: string; schematic?: "pi-gpio" };

export type DeviceSetupGuide = { title: string; eyebrow: string; intro: string; sections: GuideSection[]; docPath?: string };

export function hasDeviceSetupGuide(source: DataSource) {
  return Boolean(getDeviceSetupGuide(source));
}

export function getDeviceSetupGuide(source: DataSource): DeviceSetupGuide | null {
  if (source.type === "mqtt" && source.config.profile === "esp32-mqtt-board") return guide(source, "ESP32 MQTT Board Setup", "Flash starter firmware, connect the board to Wi-Fi, publish JSON over MQTT, then use an MQTT event workflow.", [], "docs/guides/esp32-mqtt-sensors.md");
  if (source.type === "gpio-input" && source.config.profile === "pir-motion") return pirGuide(source);
  if (source.type === "gpio-input") return gpioInputGuide(source);
  if (source.type === "gpio-output") return gpioLedGuide(source);
  if (source.type === "bme-sensor") return bme280Guide(source);
  if (source.type === "pi-camera") return piCameraGuide(source);
  if (source.type === "json-api" || source.type === "internal-json-api") return httpJsonSourceGuide(source);
  if (source.type === "webhook") return webhookGuide(source);
  if (source.type === "mqtt") return mqttSubscriberGuide(source);
  if (source.type === "http-output") return httpJsonTargetGuide(source);
  if (source.type === "mqtt-output") return mqttPublisherGuide(source);
  return null;
}

export function StandardDeviceSetupGuide({ source }: { source: DataSource }) {
  const setupGuide = getDeviceSetupGuide(source);
  if (!setupGuide) return null;
  return (
    <DeviceSetupGuideShell guide={setupGuide}>
      <div className="grid gap-3">{setupGuide.sections.map((section) => <GuideSectionCard key={section.title} section={section} />)}</div>
    </DeviceSetupGuideShell>
  );
}

export function DeviceSetupGuideShell({ guide, children }: { guide: DeviceSetupGuide; children: ReactNode }) {
  return (
    <Card className="grid max-w-4xl gap-4">
      <div>
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{guide.eyebrow}</p>
        <h3 className="m-0 mt-2">{guide.title}</h3>
        <MutedText className="m-0 mt-2">{guide.intro}</MutedText>
      </div>
      {children}
      {guide.docPath && <MutedText className="m-0">More detail: <button type="button" className="font-mono text-blue-700 underline decoration-blue-300 underline-offset-2" onClick={() => openExternalDoc(guide.docPath!)}>{guide.docPath}</button></MutedText>}
    </Card>
  );
}

function GuideSectionCard({ section }: { section: GuideSection }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <strong>{section.title}</strong>
      {section.body && <p className="m-0 leading-6">{section.body}</p>}
      {section.items && <ol className="m-0 grid gap-2 pl-5">{section.items.map((item) => <li key={item}>{item}</li>)}</ol>}
      {section.table && <div className="overflow-auto rounded-xl border border-slate-200 bg-white"><table className="w-full border-collapse text-left text-sm"><tbody>{section.table.map(([label, value]) => <tr key={label} className="border-t border-slate-200 first:border-t-0"><th className="w-44 p-3 font-extrabold text-slate-700">{label}</th><td className="p-3 text-slate-600"><code>{value}</code></td></tr>)}</tbody></table></div>}
      {section.commands && <CommandBlock value={section.commands} />}
      {section.schematic === "pi-gpio" && <button type="button" className="justify-self-start rounded-xl border border-slate-200 bg-white px-3 py-2 font-extrabold text-blue-700 shadow-sm hover:border-blue-200" onClick={openPiGpioSchematic}>Wiring schematic</button>}
    </section>
  );
}

function openPiGpioSchematic() {
  openBrowserPopup(new URL("/pi-gpio-pinout.svg", window.location.origin).href, "integritas-pi-gpio-pinout");
}

function openExternalDoc(path: string) {
  const url = `https://github.com/integritas-technology/integritas-pi/blob/main/${path}`;
  openBrowserPopup(url, "integritas-pi-guide-doc");
}

function openBrowserPopup(url: string, name: string) {
  const popup = window.open("about:blank", name, "popup=yes,width=1280,height=820");
  if (!popup) {
    window.open(url, "_blank");
    return;
  }
  popup.opener = null;
  popup.location.href = url;
  popup.focus();
}

function CommandBlock({ value }: { value: string }) {
  return <div className="grid gap-2"><textarea className="min-h-[92px] font-mono text-xs" readOnly value={value} /><Button type="button" size="xs" variant="secondary" onClick={() => navigator.clipboard?.writeText(value)}>Copy commands</Button></div>;
}

function guide(source: DataSource, title: string, intro: string, sections: GuideSection[], docPath?: string): DeviceSetupGuide {
  return { title, eyebrow: source.name, intro, sections, docPath };
}

function bme280Guide(source: DataSource) {
  return guide(source, "BME280 Environmental Sensor Setup", "Read temperature, humidity, and air pressure from a BME280 module over the Pi I2C bus.", [
    { title: "Requirements", items: ["Install with ENABLE_SENSORS=true so the host-side sensor helper is running.", "Enable I2C on the Raspberry Pi host and reboot if needed.", "Use address 0x76 first, then try 0x77 if reads fail."] },
    { title: "Wiring", schematic: "pi-gpio", table: [["VIN", "3.3V pin 1 or 5V pin 2/4"], ["GND", "GND pin 6/9/etc."], ["SCL", "GPIO3 / physical pin 5"], ["SDA", "GPIO2 / physical pin 3"]] },
    { title: "Saved settings", table: [["I2C bus", String(source.config.bus ?? 1)], ["I2C address", source.config.address ?? "0x76"]] },
    { title: "Verify", items: ["Click manual read in Devices and confirm a JSON preview appears.", "Use the source in an Automation Fetch data source block, then attach Stamp data if you want Integritas proofs."] }
  ], "docs/guides/bme280-sensor.md");
}

function gpioInputGuide(source: DataSource) {
  if (source.name.toLowerCase().includes("button")) return gpioButtonGuide(source);
  return guide(source, "GPIO Input Setup", "Record Raspberry Pi BCM pin edge events as JSON while an enabled workflow watches this source.", [
    { title: "Requirements", items: ["Install with ENABLE_GPIO=true so /dev/gpiochip0 is available to the backend.", "Use BCM pin numbering, not physical header numbering.", "Never connect a GPIO input directly to 5V."] },
    { title: "Saved settings", schematic: "pi-gpio", table: [["GPIO chip", source.config.chip ?? "gpiochip0"], ["BCM pin", String(source.config.pin ?? "?")], ["Pull", source.config.pull ?? "off"], ["Edge", source.config.edge ?? "both"], ["Active state", source.config.activeState ?? "high"]] },
    { title: "Verify", items: ["Create or enable a workflow with Start on GPIO event and this source selected.", "Trigger the input and confirm a read-history row appears with the GPIO event payload."] }
  ], "docs/guides/gpio-device-settings.md");
}

function gpioButtonGuide(source: DataSource) {
  return guide(source, "GPIO Button Setup", "Detect a simple push button connected to a Raspberry Pi GPIO input pin.", [
    { title: "Requirements", items: ["Install with ENABLE_GPIO=true so /dev/gpiochip0 is available to the backend.", "Use BCM pin numbering, not physical header numbering.", "Never connect a GPIO input directly to 5V."] },
    { title: "Typical wiring", schematic: "pi-gpio", table: [["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 17}`], ["Button path", "GPIO -> button -> GND"], ["Pull", source.config.pull ?? "up"], ["Edge", source.config.edge ?? "falling"], ["Active state", source.config.activeState ?? "low"]] },
    { title: "Verify", items: ["Create or enable a workflow with Start on GPIO event and this source selected.", "Press the button and confirm a read-history row appears with an active GPIO event."] }
  ], "docs/guides/gpio-device-settings.md");
}

function pirGuide(source: DataSource) {
  return guide(source, "PIR Motion Sensor Setup", "Detect HC-SR501-style motion events from a GPIO input pin.", [
    { title: "Requirements", items: ["Install with ENABLE_GPIO=true.", "Let the PIR sensor warm up for 60-90 seconds after power-on.", "Verify the module output voltage before connecting unknown clones to a Pi GPIO pin."] },
    { title: "Tested wiring", schematic: "pi-gpio", table: [["PIR VCC", "5V"], ["PIR GND", "GND"], ["PIR OUT", `GPIO${source.config.pin ?? 23} / physical pin 16 for GPIO23`]] },
    { title: "Recommended workflow", items: ["Use Start on GPIO event with this source.", "Enable Only run when the GPIO event is active to ignore motion_cleared events.", "Use a 30-60 second cooldown for noisy motion sensors or notifications."] }
  ], "docs/guides/gpio-device-settings.md");
}

function gpioLedGuide(source: DataSource) {
  return guide(source, "GPIO LED Output Setup", "Pulse a low-current LED from Automation control-output blocks.", [
    { title: "Requirements", items: ["Install with ENABLE_GPIO=true.", "Use a 220-330 ohm resistor in series with the LED.", "Never connect GPIO directly to 5V, motors, relays, or mains voltage."] },
    { title: "Typical wiring", schematic: "pi-gpio", table: [["GPIO", `${source.config.chip ?? "gpiochip0"} GPIO${source.config.pin ?? 18}`], ["Active state", source.config.activeState ?? "high"], ["Path", "GPIO -> resistor -> LED anode -> LED cathode -> GND"]] },
    { title: "Verify", items: ["Use the Test pulse action in Devices before adding it to a workflow.", "Use Automation Control device with Pulse once the LED behaves correctly."] }
  ], "docs/guides/gpio-device-settings.md");
}

function piCameraGuide(source: DataSource) {
  return guide(source, "Raspberry Pi Camera Setup", "Capture photos or short video clips from Automation workflows and hash captured media bytes.", [
    { title: "Requirements", items: ["Install with ENABLE_CAMERA=true so the host camera helper is running.", "Verify the Pi host can see the camera with rpicam-still --list-cameras or libcamera-still --list-cameras.", "Place the camera with consent and privacy in mind."] },
    { title: "Saved settings", table: [["Mode", source.config.mode ?? "photo"], ["Resolution", `${source.config.width ?? 1280}x${source.config.height ?? 720}`], ["Duration/warmup", `${source.config.durationMs ?? 1000} ms`], ["FPS", String(source.config.fps ?? 30)]] },
    { title: "Use in Automation", items: ["Add a Capture camera block and select this camera device.", "Attach Stamp data to create an Integritas proof for the captured media hash.", "Captured media stays on the Pi under the configured capture directory."] }
  ]);
}

function httpJsonSourceGuide(source: DataSource) {
  return guide(source, "HTTP JSON Source Setup", "Fetch JSON from an HTTP endpoint manually or from Automation workflows.", [
    { title: "Endpoint", table: [["Method", source.config.method ?? "GET"], ["URL", source.config.url ?? ""], ["Health URL", source.config.healthStatusUrl ?? "Not configured"]] },
    { title: "Requirements", items: ["The endpoint must return valid JSON.", "Use GET for normal reads, or POST when the source requires a request body configured by backend/API paths.", "Avoid placing secrets in URLs because they can appear in logs/history."] },
    { title: "Verify", items: ["Click manual read in Devices and confirm a preview/hash appears.", "Use Fetch data source in Automation for scheduled or manual workflow reads."] }
  ]);
}

function webhookGuide(source: DataSource) {
  const url = `${browserOrigin()}/api/data-source-webhooks/${source.config.webhookToken ?? "<token>"}`;
  return guide(source, "Webhook Receiver Setup", "Receive pushed JSON at a generated URL while an enabled workflow listens to this source.", [
    { title: "Endpoint", table: [["URL", url], ["Method", "POST"], ["Body", "application/json"]] },
    { title: "Use in Automation", items: ["Create or enable a workflow with Webhook received as the start block.", "POST JSON to the webhook URL.", "The app records the payload only while an enabled workflow exists for this source."] },
    { title: "Verify", commands: [`curl -X POST ${url}`, `  -H "Content-Type: application/json"`, `  -d '{"event":"test","value":1}'`].join(" \\\n") }
  ]);
}

function mqttSubscriberGuide(source: DataSource) {
  return guide(source, "MQTT Subscriber Setup", "Subscribe to a broker topic and record incoming JSON messages while an enabled workflow listens.", [
    { title: "Topic", table: [["Broker", source.config.brokerUrl ?? ""], ["Topic", source.config.topic ?? ""]] },
    { title: "Use in Automation", items: ["Create or enable a workflow with MQTT message received as the start block.", "Publish valid JSON to the configured topic.", "The backend subscribes only while an enabled workflow exists for this source."] },
    { title: "Verify", commands: `mosquitto_pub -h <broker-host> -t "${source.config.topic ?? "sensors/example/data"}" -m '{"event":"test","value":1}'` }
  ]);
}

function httpJsonTargetGuide(source: DataSource) {
  return guide(source, "HTTP JSON Target Setup", "Send JSON commands to an HTTP endpoint from Automation Control device blocks.", [
    { title: "Endpoint", table: [["Method", source.config.method ?? "POST"], ["URL", source.config.url ?? ""], ["Timeout", `${source.config.timeoutMs ?? 5000} ms`]] },
    { title: "Use in Automation", items: ["Add Control device to a workflow and select this target.", "Set the JSON body in the workflow block so this target can be reused.", "Use Test output in Devices for a basic request before enabling workflows."] }
  ]);
}

function mqttPublisherGuide(source: DataSource) {
  return guide(source, "MQTT Publisher Setup", "Publish JSON commands to a broker topic from Automation Control device blocks.", [
    { title: "Topic", table: [["Broker", source.config.brokerUrl ?? ""], ["Topic", source.config.topic ?? ""], ["QoS", String(source.config.qos ?? 0)], ["Retain", String(source.config.retain ?? false)]] },
    { title: "Use in Automation", items: ["Add Control device to a workflow and select this target.", "Set the JSON payload in the workflow block.", "Use Test output in Devices to publish a basic test message."] }
  ]);
}

function browserOrigin() {
  return typeof window === "undefined" ? "https://<pi-host>:8080" : window.location.origin;
}
