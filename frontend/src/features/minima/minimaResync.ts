import type { MinimaResyncPhase, Tone } from "../../app/types";

export const resyncPhaseLabel: Record<MinimaResyncPhase, string> = {
  starting: "Resync starting",
  in_progress: "Resync in progress",
  recovering: "Checking node recovery",
  completed: "Resync completed",
  failed: "Resync failed",
  unconfirmed: "Resync outcome unconfirmed",
};

export function resyncPhaseTone(phase: MinimaResyncPhase): Tone {
  if (phase === "completed") return "good";
  if (phase === "failed") return "error";
  return "warn";
}
