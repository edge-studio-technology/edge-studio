import {
  Activity,
  Boxes,
  Cable,
  CreditCard,
  House,
  Radio,
  Settings,
  Shield,
  ShoppingCart,
  Workflow,
} from "lucide-react";
import type { NavItem } from "./types";

export const nav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "node", label: "Minima", icon: Radio },
  { id: "wallet", label: "Wallet", icon: CreditCard },
  { id: "integritas", label: "Integritas", icon: Shield },
  { id: "data", label: "Devices", icon: Cable },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "demo/modules", label: "Module builder", icon: Boxes, badge: "Demo" },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
  { id: "marketplace", label: "Marketplace", icon: ShoppingCart, badge: "Coming soon" },
  { id: "settings", label: "Settings", icon: Settings },
];
