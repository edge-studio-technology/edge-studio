import { CircleCheck, Compass, type LucideIcon } from "lucide-react";
import { nav } from "../../app/nav";
import type { NavId } from "../../app/types";
import dashboardActivityImage from "../../assets/tour/dashboard-activity.png";
import dashboardMetricsImage from "../../assets/tour/dashboard-metrics.png";
import diagnosticsRunDetailsImage from "../../assets/tour/diagnostics-run-details.png";
import diagnosticsRunsImage from "../../assets/tour/diagnostics-runs.png";
import devicesListImage from "../../assets/tour/devices-list.png";
import devicesPickerImage from "../../assets/tour/devices-picker.png";
import integritasStampImage from "../../assets/tour/integritas-stamp.png";
import integritasVerifyImage from "../../assets/tour/integritas-verify.png";
import minimaBackupsImage from "../../assets/tour/minima-backups.png";
import minimaStatusImage from "../../assets/tour/minima-status.png";
import walletAddressBookImage from "../../assets/tour/wallet-address-book.png";
import walletBalanceImage from "../../assets/tour/wallet-balance.png";
import welcomeImage from "../../assets/tour/welcome.png";
import workflowsCanvasImage from "../../assets/tour/workflows-canvas.png";
import workflowsListImage from "../../assets/tour/workflows-list.png";

export type TourImage = { src: string; alt: string };

export type TourStep = {
  id: string;
  title: string;
  lead: string;
  icon: LucideIcon;
  /** Each image fills the frame; two or more crossfade in order on a timer. */
  images?: TourImage[];
  brand?: boolean;
};

function navStep(id: NavId, lead: string, images?: TourImage[]): TourStep {
  const item = nav.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown nav item: ${id}`);
  return { id, title: item.label, lead, icon: item.icon, images };
}

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Edge Studio",
    lead: "Your hub for sensors and connected equipment.",
    icon: Compass,
    images: [{ src: welcomeImage, alt: "The Edge Studio dashboard with the sidebar open" }],
  },
  navStep(
    "dashboard",
    "Your home screen, and the best place to start.",
    [
      { src: dashboardMetricsImage, alt: "Dashboard status cards for wallet, node, and device" },
      { src: dashboardActivityImage, alt: "Dashboard live activity list" },
    ],
  ),
  navStep(
    "node",
    "The network that keeps a permanent, tamper-proof record of your data.",
    [
      { src: minimaStatusImage, alt: "Minima node status cards above the open RPC console" },
      { src: minimaBackupsImage, alt: "Minima node backups list with download actions" },
    ],
  ),
  navStep(
    "wallet",
    "The coins and tokens that belong to this device.",
    [
      { src: walletBalanceImage, alt: "Wallet balance with Send and Receive buttons" },
      { src: walletAddressBookImage, alt: "Wallet address book with a New contact button" },
    ],
  ),
  navStep(
    "integritas",
    "Proof that your data is genuine.",
    [
      {
        src: integritasStampImage,
        alt: "Integritas stamp tab with a sensor readings file ready to stamp",
      },
      { src: integritasVerifyImage, alt: "Integritas proof verification showing a full match" },
    ],
  ),
  navStep(
    "data",
    "Connect the things your workflows use.",
    [
      { src: devicesListImage, alt: "Configured devices list with a New device button" },
      { src: devicesPickerImage, alt: "Setup Device picker with Boards, Protocols, and Sensors" },
    ],
  ),
  navStep(
    "workflows",
    "Put your devices to work automatically.",
    [
      {
        src: workflowsListImage,
        alt: "Workflows list with an enabled workflow and a New workflow button",
      },
      {
        src: workflowsCanvasImage,
        alt: "Workflow canvas with a start block followed by action blocks",
      },
    ],
  ),
  navStep(
    "diagnostics",
    "Where to look when something doesn't seem right.",
    [
      { src: diagnosticsRunsImage, alt: "Diagnostics tabs and workflow logs with successful and failed runs" },
      {
        src: diagnosticsRunDetailsImage,
        alt: "Failed workflow run details with its trigger, status, and duration",
      },
    ],
  ),
  {
    id: "done",
    title: "You're ready to go",
    lead: "A good first step: add a device, then build a workflow that uses it.",
    icon: CircleCheck,
    brand: true,
  },
];
