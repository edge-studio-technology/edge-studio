import { CircleCheck, Compass, type LucideIcon } from "lucide-react";
import { nav } from "../../app/nav";
import type { NavId } from "../../app/types";
import dashboardActivityImage from "../../assets/tour/dashboard-activity.png";
import dashboardMetricsImage from "../../assets/tour/dashboard-metrics.png";
import integritasStampImage from "../../assets/tour/integritas-stamp.png";
import integritasVerifyImage from "../../assets/tour/integritas-verify.png";
import minimaBackupsImage from "../../assets/tour/minima-backups.png";
import minimaStatusImage from "../../assets/tour/minima-status.png";
import walletAddressBookImage from "../../assets/tour/wallet-address-book.png";
import walletBalanceImage from "../../assets/tour/wallet-balance.png";
import welcomeImage from "../../assets/tour/welcome.png";

export type TourImage = { src: string; alt: string };

export type TourStep = {
  id: string;
  title: string;
  lead: string;
  points: string[];
  icon: LucideIcon;
  /** One image fills the frame; two are split diagonally, first on the left. */
  images?: TourImage[];
  brand?: boolean;
};

function navStep(id: NavId, lead: string, points: string[], images?: TourImage[]): TourStep {
  const item = nav.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown nav item: ${id}`);
  return { id, title: item.label, lead, points, icon: item.icon, images };
}

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Edge Studio",
    lead: "Your hub for sensors and connected equipment.",
    points: [
      "Collect readings from your devices",
      "Decide automatically what happens next",
      "Keep a trustworthy record that shows your data hasn't changed",
    ],
    icon: Compass,
    images: [{ src: welcomeImage, alt: "The Edge Studio dashboard with the sidebar collapsed" }],
  },
  navStep(
    "dashboard",
    "Your home screen, and the best place to start.",
    [
      "See at a glance whether everything is running",
      "Follow live activity as it happens",
      "Get a suggested next step",
    ],
    [
      { src: dashboardActivityImage, alt: "Dashboard live activity list" },
      { src: dashboardMetricsImage, alt: "Dashboard status cards for wallet, node, and device" },
    ],
  ),
  navStep(
    "node",
    "The network that keeps a permanent, tamper-proof record of your data.",
    [
      "Check that your connection is healthy",
      "Make regular backups",
      "Restore from a backup if something goes wrong",
    ],
    [
      { src: minimaBackupsImage, alt: "Minima node backup and restore settings" },
      { src: minimaStatusImage, alt: "Minima node running and sync status cards" },
    ],
  ),
  navStep(
    "wallet",
    "The coins and tokens that belong to this device.",
    [
      "Check your balance",
      "Share your address to receive funds",
      "Save the people you pay often in your address book",
    ],
    [
      { src: walletBalanceImage, alt: "Wallet balance with Send and Receive buttons" },
      { src: walletAddressBookImage, alt: "Wallet address book with a New contact button" },
    ],
  ),
  navStep(
    "integritas",
    "Proof that your data is genuine.",
    [
      "Stamp a file to prove it hasn't been altered",
      "Verify a proof anytime",
      "Find every proof you've created in one list",
    ],
    [
      {
        src: integritasStampImage,
        alt: "Integritas stamp tab with a sensor readings file ready to stamp",
      },
      { src: integritasVerifyImage, alt: "Integritas proof verification showing a full match" },
    ],
  ),
  navStep("data", "Connect the things your workflows use.", [
    "Collect data from sensors, cameras, or other apps",
    "Control things like a light",
    "Add your first device here, then use it in a workflow",
  ]),
  navStep("workflows", "Put your devices to work automatically.", [
    "Choose what starts it",
    "Add a check if you need one",
    "Pick what happens, like stamping a reading or switching something on",
  ]),
  navStep("diagnostics", "Where to look when something doesn't seem right.", [
    "See every reading your devices sent",
    "See every time a workflow ran",
    "Get details on anything that failed",
  ]),
  {
    id: "done",
    title: "You're ready to go",
    lead: "A good first step: add a device, then build a workflow that uses it.",
    points: [
      "Check the Dashboard for your suggested next step",
      "Replay this tour anytime in Settings under Behaviour",
      "Tell us what would help with Feedback in the sidebar",
    ],
    icon: CircleCheck,
    brand: true,
  },
];
