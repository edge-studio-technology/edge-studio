import {
  Activity,
  Database,
  House,
  RadioTower,
  // Settings, // unused while the Setup nav item is commented out above
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Wallet,
  Workflow,
} from "lucide-react";
import type { NavItem } from "./types";

export const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House },
  // Setup nav item hidden pending relocation of its actions. Left commented, not
  // deleted, for an easy revert.
  // { id: "setup", label: "Setup", icon: Settings },
  { id: "node", label: "Minima", icon: RadioTower },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "integritas", label: "Integritas", icon: ShieldCheck },
  { id: "data", label: "Devices", icon: Database },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "marketplace", label: "Marketplace", icon: ShoppingCart, badge: "Coming soon" },
  { id: "settings", label: "Account", icon: UserRound },
];
