import {
  Activity,
  Cable,
  CreditCard,
  House,
  Radio,
  // Settings, // unused while the Setup nav item is commented out above
  Shield,
  ShoppingCart,
  UserRound,
  Workflow,
} from "lucide-react";
import type { NavItem } from "./types";

export const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House },
  // Setup nav item hidden pending relocation of its actions. Left commented, not
  // deleted, for an easy revert.
  // { id: "setup", label: "Setup", icon: Settings },
  { id: "node", label: "Minima", icon: Radio },
  { id: "wallet", label: "Wallet", icon: CreditCard },
  { id: "integritas", label: "Integritas", icon: Shield },
  { id: "data", label: "Devices", icon: Cable },
  { id: "automation", label: "Workflows", icon: Workflow },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "marketplace", label: "Marketplace", icon: ShoppingCart, badge: "Coming soon" },
  { id: "settings", label: "Account", icon: UserRound },
];
