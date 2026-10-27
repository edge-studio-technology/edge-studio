import { createContext, useContext, useState, type ReactNode } from "react";
import { useToast } from "../../components/ToastProvider";
import { demoDrafts, demoModules, type DemoDraft, type DemoModule } from "./demoData";
import { rateModule } from "./moduleRatingMath";

type DemoState = {
  modules: DemoModule[];
  drafts: DemoDraft[];
  activity: string[];
  install: (id: string) => void;
  uninstall: (id: string) => void;
  toggle: (id: string) => void;
  update: (id: string) => void;
  saveDraft: (draft: DemoDraft) => void;
  publish: (draft: DemoDraft) => void;
  activate: (draft: DemoDraft) => void;
  rate: (id: string, score: number) => void;
  reset: () => void;
};

const Context = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState(demoModules);
  const [drafts, setDrafts] = useState(demoDrafts);
  const [activity, setActivity] = useState([
    "Environmental Sensors update available · Today",
    "HTTP Toolkit activated · Yesterday",
    "Greenhouse Monitor draft saved · Yesterday",
  ]);
  const { showToast } = useToast();
  function record(message: string) {
    setActivity((items) => [`${message} · Just now`, ...items]);
  }
  function change(id: string, patch: Partial<DemoModule>) {
    setModules((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  const value: DemoState = {
    modules,
    drafts,
    activity,
    install(id) {
      setModules((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                installed: true,
                enabled: true,
                downloads: item.downloads + (!item.installed && !item.localOnly ? 1 : 0),
              }
            : item,
        ),
      );
      record(`${modules.find((item) => item.id === id)?.name} installed`);
      showToast({
        title: "Module added to your workspace",
        message: "Demo installation complete. No software was downloaded or executed.",
        tone: "success",
      });
    },
    uninstall(id) {
      change(id, { installed: false, enabled: false });
      record(`${modules.find((item) => item.id === id)?.name} removed`);
      showToast({
        title: "Module removed from the demo",
        message: "Device settings and workflows are preserved in this preview.",
        tone: "success",
      });
    },
    toggle(id) {
      const item = modules.find((module) => module.id === id);
      if (item) {
        change(id, { enabled: !item.enabled });
        record(`${item.name} ${item.enabled ? "disabled" : "activated"}`);
      }
    },
    update(id) {
      const item = modules.find((module) => module.id === id);
      if (item?.update) {
        change(id, {
          version: item.update,
          update: undefined,
          downloads: item.downloads + (item.localOnly ? 0 : 1),
        });
        record(`${item.name} updated`);
        showToast({
          title: `${item.name} is up to date`,
          message: "Sample version updated in the demo.",
          tone: "success",
        });
      }
    },
    saveDraft(draft) {
      setDrafts((items) =>
        items.some((item) => item.id === draft.id)
          ? items.map((item) => (item.id === draft.id ? { ...draft, saved: true } : item))
          : [...items, { ...draft, saved: true }],
      );
      record(`${draft.name} draft saved`);
    },
    publish(draft) {
      const published: DemoModule = {
        id: `community-${draft.id}`,
        name: draft.name,
        summary: draft.description,
        description: draft.description,
        category:
          draft.icon === "cpu" ? "Hardware" : draft.icon === "thermometer" ? "Devices" : "Workflow",
        icon: draft.icon,
        color: draft.color,
        author: "Alex Morgan",
        official: false,
        version: "0.1.0",
        downloads: 0,
        ratingCount: 0,
        ratingTotal: 0,
        contributions: [
          draft.icon === "cpu"
            ? "1 hardware capability"
            : draft.icon === "thermometer"
              ? "1 device type"
              : "1 workflow block",
        ],
        hostAccess: draft.icon === "cpu",
        installed: false,
        enabled: false,
      };
      setModules((items) => {
        const existing = items.find((item) => item.id === published.id);
        return [
          {
            ...published,
            ...(existing
              ? {
                  downloads: existing.downloads,
                  ratingCount: existing.ratingCount,
                  ratingTotal: existing.ratingTotal,
                  userRating: existing.userRating,
                  installed: existing.installed,
                  enabled: existing.enabled,
                }
              : {}),
          },
          ...items.filter((item) => item.id !== published.id),
        ];
      });
      record(`${draft.name} published to the demo library`);
    },
    activate(draft) {
      const local: DemoModule = {
        id: `local-${draft.id}`,
        name: draft.name,
        summary: draft.description,
        description: draft.description,
        category:
          draft.icon === "cpu" ? "Hardware" : draft.icon === "thermometer" ? "Devices" : "Workflow",
        icon: draft.icon,
        color: draft.color,
        author: "You",
        official: false,
        version: "0.1.0",
        downloads: 0,
        ratingCount: 0,
        ratingTotal: 0,
        contributions: [
          draft.icon === "cpu"
            ? "1 hardware capability"
            : draft.icon === "thermometer"
              ? "1 device type"
              : "1 workflow block",
        ],
        hostAccess: draft.icon === "cpu",
        installed: true,
        enabled: true,
        localOnly: true,
      };
      setModules((items) => [local, ...items.filter((item) => item.id !== local.id)]);
      record(`${draft.name} activated locally`);
      showToast({
        title: "Module activated in the demo",
        message: "Find it under Installed. Your code has not been executed.",
        tone: "success",
      });
    },
    rate(id, score) {
      setModules((items) =>
        items.map((item) => (item.id === id && !item.localOnly ? rateModule(item, score) : item)),
      );
      showToast({
        title: "Your demo rating is saved",
        message: "Module and builder averages are updated in this session.",
        tone: "success",
      });
    },
    reset() {
      setModules(demoModules);
      setDrafts(demoDrafts);
      setActivity(["Demo workspace reset · Just now"]);
      showToast({ title: "Demo reset", tone: "info" });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("Module demo requires its provider");
  return value;
}
