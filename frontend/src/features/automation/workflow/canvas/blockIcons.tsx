import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Inbox,
  Play,
  Radio,
  Send,
  ShieldCheck,
  Timer,
  Variable,
  Webhook,
  Zap,
} from "lucide-react";
import { cx } from "../../../../lib/cx";
import type { AutomationBlockType } from "../../automationTypes";
import { isDataBlock } from "./blockPresentation";

const blockIconTileBaseClass = "flex size-7 shrink-0 items-center justify-center rounded-full";

/** Soft tint + icon color by category; shape/icon carry meaning so color isn’t the only cue. */
function blockIconToneClass(type: AutomationBlockType) {
  if (type.endsWith("_start")) return "bg-feedback-warning/20 text-icon-warning";
  if (isDataBlock(type)) return "bg-[#2563EB]/15 text-[#2563EB]";
  if (type === "set_variable" || type === "if_payload_field_equals" || type === "wait")
    return "bg-surface-accent/15 text-text-accent";
  if (type === "stamp_integritas") return "bg-feedback-positive/20 text-icon-success";
  return "bg-[#DB2777]/15 text-[#DB2777]";
}

const blockTypeIcon: Record<AutomationBlockType, LucideIcon> = {
  manual_start: Play,
  schedule_start: Clock,
  gpio_event_start: Cpu,
  webhook_event_start: Webhook,
  mqtt_event_start: Radio,
  record_trigger_event: Inbox,
  fetch_data_source: Database,
  capture_camera: Camera,
  set_variable: Variable,
  if_payload_field_equals: GitBranch,
  wait: Timer,
  show_preview: Zap,
  stamp_integritas: ShieldCheck,
  control_output: Cpu,
  send_transaction: Send,
};

export function WorkflowBlockTypeIcon({
  type,
  className,
}: {
  type: AutomationBlockType;
  className?: string;
}) {
  const Icon = blockTypeIcon[type];
  return (
    <span className={cx(blockIconTileBaseClass, blockIconToneClass(type), className)} aria-hidden>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  );
}
