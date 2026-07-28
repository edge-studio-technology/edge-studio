import {
  Activity,
  Database,
  House,
  RadioTower,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
  Workflow,
} from "lucide-react";
import type { NavItem } from "./types";

export const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "setup", label: "Setup", icon: Settings },
  { id: "node", label: "Minima Core", icon: RadioTower },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "integritas", label: "Integritas", icon: ShieldCheck },
  { id: "data", label: "Devices", icon: Database },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "settings", label: "Account", icon: UserRound },
];
