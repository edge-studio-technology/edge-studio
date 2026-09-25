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
    body: "Edge Studio turns this device into a hub for your sensors and connected equipment. Collect their readings, decide what happens next, and keep a trustworthy record that shows your data hasn't been changed. Here's a quick look around.",
    icon: Compass,
  },
  navStep(
    "dashboard",
    "Your home screen. See at a glance whether everything is running, follow live activity as it happens, and get a suggested next step. Start here whenever you open Edge Studio.",
  ),
  navStep(
    "node",
    "Minima is the network Edge Studio uses to keep a permanent, tamper-proof record of your data. Check here that your connection is healthy, and make regular backups so you can recover if something goes wrong.",
  ),
  navStep(
    "wallet",
    "Your wallet holds the coins and tokens that belong to this device. Check your balance, share your address to receive funds, and save the people you pay often in your address book.",
  ),
  navStep(
    "integritas",
    "Integritas proves your data is genuine. Stamp a file to create a proof that it existed and hasn't been altered since, then verify it anytime. Every proof you create is listed here.",
  ),
  navStep(
    "data",
    "Connect what you want to collect data from, like sensors, cameras, or other apps, and what you want to control, like a light. Add your first device here, then use it in a workflow.",
  ),
  navStep(
    "workflows",
    "Workflows put your devices to work automatically. Choose what starts one, add a check if you need it, then pick what happens, like stamping a reading or switching something on. Build it once and Edge Studio runs it for you.",
  ),
  navStep(
    "diagnostics",
    "When something doesn't look right, look here. See every reading your devices sent and every time a workflow ran, with details on anything that failed.",
  ),
  {
    id: "done",
    title: "You're ready to go",
    body: "A good first step: add a device, then build a workflow that uses it. You can replay this tour anytime from Settings under Behaviour, and use Feedback in the sidebar to tell us what would help.",
    icon: CircleCheck,
  },
];
