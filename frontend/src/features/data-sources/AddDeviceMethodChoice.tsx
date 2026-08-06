import { OptionCard } from "../../components/patterns/OptionCard";

export function AddDeviceMethodChoice({
  mode,
  onSelect,
}: {
  mode: "input" | "output";
  onSelect: (category: "template" | "manual") => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OptionCard
        eyebrow="Guided"
        title="Start from a template"
        description={
          <>
            Use guided presets for common{" "}
            {mode === "input"
              ? "devices, sensors, cameras, and board examples"
              : "output devices and hardware setups"}
            .
          </>
        }
        actionLabel="Choose template"
        onClick={() => onSelect("template")}
      />
      <OptionCard
        eyebrow="Manual"
        title="Define manually"
        description={
          <>
            Configure the{" "}
            {mode === "input"
              ? "protocol, endpoint, topic, or GPIO input settings"
              : "endpoint, MQTT topic, or output target settings"}{" "}
            yourself.
          </>
        }
        actionLabel="Choose manual setup"
        onClick={() => onSelect("manual")}
      />
    </div>
  );
}
