import { ArrowLeft, Cable, ChevronRight, Cpu, Radio, ThermometerSun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { useToast } from "../../../components/ToastProvider";
import { buildDeviceConfigInput } from "../buildDeviceConfig";
import { createDataSource } from "../dataSourcesApi";
import type { DataSource, DataSourceCapabilities, DataSourceTemplate, HostCapability } from "../dataSourceTypes";
import { useDeviceFormFields } from "../useDeviceFormFields";
import { AltDeviceForm, isAltDeviceFormValid } from "./AltDeviceForm";
import { inputTemplates, outputTemplates, resolveTemplateConfig, templateIcon } from "../DataSourceTemplates";

type WizardStep = "root" | "boards" | "protocols" | "protocol-inbound" | "protocol-outbound" | "sensors" | "sensor-templates";

type WizardOption = {
  title: string;
  description: string;
  icon: LucideIcon;
  action: () => void;
};

const environmentalSensorOption: DataSourceTemplate = {
  title: "BME280 / BME680 Environmental Sensor",
  description: "Read temperature, humidity, pressure, and BME680 gas resistance over I2C",
  type: "bme-sensor",
  config: { sensor: "bme280", bus: 1, address: "0x76" },
};

/**
 * Setup-device flow: category picker -> optional subcategory -> configure. Uses the
 * existing data-source templates so the saved devices and setup guides stay unchanged.
 */
export function AltAddDeviceFlow({
  open,
  capabilities,
  onClose,
  onCreated,
}: {
  open: boolean;
  capabilities: DataSourceCapabilities | null;
  hostCapabilities?: HostCapability[];
  onClose: () => void;
  onCreated: (source: DataSource) => void;
}) {
  const { showToast } = useToast();
  const [step, setStep] = useState<WizardStep>("root");
  const [template, setTemplate] = useState<DataSourceTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { fields, reset, fillFromTemplate } = useDeviceFormFields();

  useEffect(() => {
    if (!open) return;
    setStep("root");
    setTemplate(null);
    reset();
    // Reset only when a fresh open is requested, not on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function selectTemplate(next: DataSourceTemplate) {
    const resolved = { ...next, config: resolveTemplateConfig(next, capabilities) };
    fillFromTemplate(resolved);
    setTemplate(resolved);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const response = await createDataSource({
        name: fields.name,
        description: fields.description,
        type: fields.type,
        config: buildDeviceConfigInput(fields, { template }),
      });
      showToast({ tone: "success", title: "Device added" });
      onCreated(response.item);
    } catch (err) {
      showToast({
        tone: "error",
        title: "Device action failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (template) {
      setTemplate(null);
      return;
    }
    setStep(parentStep(step));
  }

  const options = stepOptions(step, setStep, selectTemplate);

  if (template) {
    return (
      <Modal
        title={<SetupDeviceBreadcrumb step={step} final="Add device" />}
        closeDisabled={saving}
        onClose={onClose}
        width="wide"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              iconStart={<ArrowLeft aria-hidden />}
              onClick={goBack}
            >
              Back
            </Button>
            <Button
              disabled={saving || !isAltDeviceFormValid(fields)}
              onClick={() => void handleSubmit()}
            >
              Add device
            </Button>
          </>
        }
      >
        <AltDeviceForm template={template} fields={fields} />
      </Modal>
    );
  }

  return (
    <Modal
      title={<SetupDeviceBreadcrumb step={step} />}
      onClose={onClose}
      width="wide"
      bodyClassName="min-h-0 flex-1"
      footer={
        step === "root" ? (
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" iconStart={<ArrowLeft aria-hidden />} onClick={goBack}>
            Back
          </Button>
        )
      }
    >
      <SetupDevicePicker step={step} options={options} />
    </Modal>
  );
}

function SetupDevicePicker({ step, options }: { step: WizardStep; options: WizardOption[] }) {
  return (
    <div className="gap-detail-near grid">
      <div>
        <h3 className="type-title text-text-primary m-0">{stepIntro(step).title}</h3>
        <p className="type-body text-text-secondary mt-detail-tight m-0">{stepIntro(step).description}</p>
      </div>
      <div className="gap-detail-close grid auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.title}
            type="button"
            className="border-stroke-secondary bg-surface-primary hover:border-stroke-primary rounded-soft gap-detail-close flex h-full flex-col border p-pad-tight text-left transition-colors"
            onClick={option.action}
          >
            <option.icon className="text-icon-primary size-6 shrink-0" aria-hidden />
            <span className="gap-detail-tight flex flex-col">
              <span className="type-body-em text-text-primary">{option.title}</span>
              <span className="type-body text-text-secondary">{option.description}</span>
            </span>
            <span className="type-link text-text-accent mt-auto no-underline">Choose</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupDeviceBreadcrumb({ step, final }: { step: WizardStep; final?: string }) {
  const parts = ["Setup Device", ...stepPath(step)];
  if (final) parts.push(final);

  return (
    <span className="gap-detail-tight flex flex-wrap items-center">
      {parts.map((part, index) => (
        <span key={part} className="gap-detail-tight flex items-center">
          {index > 0 && <ChevronRight className="text-text-tertiary" size={18} aria-hidden />}
          <span className={index === parts.length - 1 ? "" : "text-text-tertiary"}>{part}</span>
        </span>
      ))}
    </span>
  );
}

function stepIntro(step: WizardStep) {
  switch (step) {
    case "boards":
      return { title: "Boards", description: "Connect a microcontroller board and generate starter setup." };
    case "protocols":
      return { title: "Protocols", description: "Receive data or send commands using REST APIs, MQTT, or webhooks." };
    case "protocol-inbound":
      return { title: "Inbound protocols", description: "Create sources that receive, subscribe to, or fetch JSON into workflows." };
    case "protocol-outbound":
      return { title: "Outbound protocols", description: "Create targets that workflows can command with JSON payloads." };
    case "sensors":
      return { title: "Sensors", description: "Add Pi-connected hardware templates or configure a GPIO input yourself." };
    case "sensor-templates":
      return { title: "Template devices", description: "Start from known GPIO and I2C sensor presets." };
    default:
      return { title: "Choose what you want to set up", description: "Start with a board, protocol integration, or Pi-connected sensor." };
  }
}

function stepPath(step: WizardStep) {
  switch (step) {
    case "boards":
      return ["Boards"];
    case "protocols":
      return ["Protocols"];
    case "protocol-inbound":
      return ["Protocols", "Inbound"];
    case "protocol-outbound":
      return ["Protocols", "Outbound"];
    case "sensors":
      return ["Sensors"];
    case "sensor-templates":
      return ["Sensors", "Template devices"];
    default:
      return [];
  }
}

function parentStep(step: WizardStep): WizardStep {
  if (step === "protocol-inbound" || step === "protocol-outbound") return "protocols";
  if (step === "sensor-templates") return "sensors";
  return "root";
}

function stepOptions(
  step: WizardStep,
  setStep: (step: WizardStep) => void,
  selectTemplate: (template: DataSourceTemplate) => void,
): WizardOption[] {
  switch (step) {
    case "boards":
      return [templateOption("ESP32", "Create an ESP32 MQTT board and get starter Arduino firmware after saving.", findInputTemplate("ESP32 MQTT Board"), selectTemplate)];
    case "protocols":
      return [
        { title: "Inbound", description: "Fetch, receive, or subscribe to JSON data for workflows.", icon: Radio, action: () => setStep("protocol-inbound") },
        { title: "Outbound", description: "Send JSON commands from workflows to an external service or device.", icon: Cable, action: () => setStep("protocol-outbound") },
      ];
    case "protocol-inbound":
      return [
        templateOption("REST API", "Fetch JSON from an external API, Pi service, or Docker-network endpoint.", findInputTemplate("HTTP JSON Source"), selectTemplate),
        templateOption("MQTT", "Subscribe to a broker topic and ingest JSON messages.", findInputTemplate("MQTT Subscriber"), selectTemplate),
        templateOption("Webhook", "Generate a URL that receives pushed JSON from another app or device.", findInputTemplate("Webhook Receiver"), selectTemplate),
      ];
    case "protocol-outbound":
      return [
        templateOption("REST API", "Send JSON commands to an HTTP endpoint from workflows.", findOutputTemplate("HTTP JSON Target"), selectTemplate),
        templateOption("MQTT", "Publish JSON commands from workflows to a broker topic.", findOutputTemplate("MQTT Publisher"), selectTemplate),
      ];
    case "sensors":
      return [
        { title: "Template devices", description: "Use presets for buttons, motion sensors, LEDs, and BME environmental sensors.", icon: ThermometerSun, action: () => setStep("sensor-templates") },
        templateOption("Any device", "Configure a custom Raspberry Pi GPIO input pin manually.", findInputTemplate("GPIO Input Pin"), selectTemplate),
      ];
    case "sensor-templates":
      return [
        templateOption("GPIO Button", "Detect a simple push button wired between GPIO17 and GND.", findInputTemplate("GPIO Button"), selectTemplate),
        templateOption("PIR Motion Sensor", "Detect HC-SR501-style motion events from a GPIO input pin.", findInputTemplate("PIR Motion Sensor"), selectTemplate),
        templateOption("GPIO LED", "Control a low-current LED output from workflow action blocks.", findOutputTemplate("GPIO LED"), selectTemplate),
        templateOption(environmentalSensorOption.title, environmentalSensorOption.description, environmentalSensorOption, selectTemplate),
      ];
    default:
      return [
        { title: "Boards", description: "Connect a microcontroller board and generate starter setup.", icon: Cpu, action: () => setStep("boards") },
        { title: "Protocols", description: "Receive data or send commands using REST APIs, MQTT, or webhooks.", icon: Radio, action: () => setStep("protocols") },
        { title: "Sensors", description: "Add GPIO and environmental sensor devices attached to this Pi.", icon: ThermometerSun, action: () => setStep("sensors") },
      ];
  }
}

function templateOption(
  title: string,
  description: string,
  template: DataSourceTemplate,
  selectTemplate: (template: DataSourceTemplate) => void,
): WizardOption {
  return { title, description, icon: templateIcon(template), action: () => selectTemplate(template) };
}

function findInputTemplate(title: string) {
  return findTemplate(inputTemplates, title);
}

function findOutputTemplate(title: string) {
  return findTemplate(outputTemplates, title);
}

function findTemplate(templates: DataSourceTemplate[], title: string) {
  const template = templates.find((item) => item.title === title);
  if (!template) throw new Error(`Missing setup device template: ${title}`);
  return template;
}
