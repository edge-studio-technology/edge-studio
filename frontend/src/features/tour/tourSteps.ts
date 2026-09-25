import { CircleCheck, Compass, type LucideIcon } from "lucide-react";
import { nav } from "../../app/nav";
import type { NavId } from "../../app/types";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  image?: string;
  imageAlt?: string;
};

function navStep(id: NavId, body: string): TourStep {
  const item = nav.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown nav item: ${id}`);
  return { id, title: item.label, body, icon: item.icon };
}

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Edge Studio",
    body: "Edge Studio connects your devices, automates what happens with their data, and proves that data on the Minima blockchain through Integritas. This short tour walks through each area.",
    icon: Compass,
  },
  navStep(
    "dashboard",
    "See the health of your node, devices, and workflows at a glance, along with the suggested next step.",
  ),
  navStep(
    "node",
    "Manage your Minima node: check its status and peers, create and restore backups, and use the RPC console.",
  ),
  navStep(
    "wallet",
    "View balances, send and receive Minima and tokens, and keep an address book of contacts.",
  ),
  navStep(
    "integritas",
    "Stamp files and data on the blockchain, track proofs as they confirm, and verify them later.",
  ),
  navStep(
    "data",
    "Connect data sources such as sensors, webhooks, MQTT, the camera, and GPIO pins, plus output targets to act on.",
  ),
  navStep(
    "workflows",
    "Build automations from blocks: when something happens, check a condition, then act on it.",
  ),
  navStep(
    "diagnostics",
    "Inspect data reads, workflow runs, and errors to troubleshoot when something doesn't behave as expected.",
  ),
  {
    id: "done",
    title: "You're all set",
    body: "Adjust Edge Studio in Settings, where you can also replay this tour under Behaviour. Use the Feedback button in the sidebar to tell us what would help.",
    icon: CircleCheck,
  },
];
