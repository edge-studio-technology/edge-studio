import { MutedText } from "../../components/Text";

export type AddDeviceStep =
  "input" | "output" | "input-template" | "input-manual" | "output-template" | "output-manual";

export function AddDeviceMethodChoice({
  mode,
  onSelect,
}: {
  mode: "input" | "output";
  onSelect: (category: "template" | "manual") => void;
}) {
  return (
    <div className="grid min-h-[min(520px,calc(90vh-160px))] gap-4 md:grid-cols-2">
      <button
        type="button"
        className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]"
        onClick={() => onSelect("template")}
      >
        <div>
          <span className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
            Guided
          </span>
          <h3 className="mt-3 text-2xl">Start from a template</h3>
          <MutedText className="m-0 mt-2">
            Use guided presets for common{" "}
            {mode === "input"
              ? "devices, sensors, cameras, and board examples"
              : "output devices and hardware setups"}
            .
          </MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose template</span>
      </button>
      <button
        type="button"
        className="grid min-h-[240px] content-between gap-6 rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]"
        onClick={() => onSelect("manual")}
      >
        <div>
          <span className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
            Manual
          </span>
          <h3 className="mt-3 text-2xl">Define manually</h3>
          <MutedText className="m-0 mt-2">
            Configure the{" "}
            {mode === "input"
              ? "protocol, endpoint, topic, or GPIO input settings"
              : "endpoint, MQTT topic, or output target settings"}{" "}
            yourself.
          </MutedText>
        </div>
        <span className="font-extrabold text-blue-700">Choose manual setup</span>
      </button>
    </div>
  );
}

export function addDeviceBreadcrumb(mode: AddDeviceStep) {
  const parts = [mode.startsWith("input") ? "Add input source" : "Add output target"];
  if (mode.includes("template")) parts.push("Template");
  if (mode.endsWith("manual")) parts.push("Manual");
  return parts.join(" > ");
}

export function previousAddDeviceStep(mode: AddDeviceStep) {
  return mode.startsWith("input") ? "input" : "output";
}
