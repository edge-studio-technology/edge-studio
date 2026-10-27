export const dimensions = [
  {
    id: "breadth",
    label: "Contribution breadth",
    short: "Breadth",
    question: "What should people outside the core team be able to contribute?",
    description:
      "Consider the kinds of additions, independently of how they are reviewed or released.",
    levels: [
      "No external contribution; the team implements requests",
      "Device presets, mappings, and guides",
      "Device integrations and reusable workflow blocks",
      "New drivers, protocols, and executable logic",
      "Cross-surface extensions: drivers, logic, and custom experiences",
    ],
  },
  {
    id: "guidance",
    label: "Operator guidance",
    short: "Guidance",
    question: "How guided should installing and using capabilities be?",
    description:
      "This concerns operators using a capability. Creator tools are a separate question.",
    levels: [
      "Technical documentation and manual setup",
      "Examples and a documented setup checklist",
      "Guided configuration with some manual steps",
      "A mostly guided setup and troubleshooting experience",
      "End-to-end discovery, setup, testing, and helpful recovery",
    ],
  },
  {
    id: "authoring",
    label: "Creator tools",
    short: "Creator tools",
    question: "What tools should we provide to people creating contributions?",
    description:
      "AI-assisted external creation can work at several levels. This scale measures the tools we build and maintain.",
    levels: [
      "Documentation; contributors use their own tools",
      "Reference implementations and starter templates",
      "A supported SDK/CLI with validation and packaging",
      "An in-app editor with configuration and previews",
      "A complete module workspace: templates, preview, tests, packaging, and publishing",
    ],
  },
  {
    id: "interface",
    label: "UI customization",
    short: "Custom UI",
    question: "How much should a contribution be able to change the user experience?",
    description: "Keep interface freedom separate from permission to execute host code.",
    levels: [
      "Use the existing UI without adding fields or screens",
      "Add presets and values to existing forms",
      "Define forms, setup guides, and wizard steps",
      "Provide custom block editors and device interactions",
      "Provide new views and experiences across the app",
    ],
  },
  {
    id: "distribution",
    label: "Sharing and distribution",
    short: "Distribution",
    question: "How far should self-service distribution go?",
    description:
      "A public website, package delivery, and publication operations are larger commitments than file sharing.",
    levels: [
      "Capabilities ship only in core app releases",
      "Manual file sharing or repository links",
      "Independent versioned packages with install/import support",
      "A curated catalog with managed delivery and updates",
      "A public self-service library with publisher profiles and reputation",
    ],
  },
  {
    id: "validation",
    label: "Validation depth",
    short: "Validation",
    question: "How much evidence should be required before a contribution is usable?",
    description:
      "This measures depth of checking, not whether developers or the community do it. Ratings are not code-safety verification.",
    levels: [
      "Basic manifest/schema and format checks",
      "Author checks and documented manual tests",
      "Repeatable functional tests and an explicit review process",
      "Automated compatibility checks, regression tests, and release checks",
      "Qualification on supported hardware plus ongoing compatibility verification",
    ],
  },
  {
    id: "lifecycle",
    label: "Lifecycle and recovery",
    short: "Lifecycle",
    question: "How much should the system manage after installation?",
    description:
      "Include existing devices, saved workflows, dependency conflicts, upgrades, and failed installation.",
    levels: [
      "Manual replacement and recovery",
      "Documented installation/removal and backup procedures",
      "Version tracking, compatibility checks, and preserved configuration",
      "Dependency handling, pinned versions, staged updates, and recovery",
      "A managed lifecycle with health, recovery, migrations, and verified restoration",
    ],
  },
  {
    id: "autonomy",
    label: "Contributor independence",
    short: "Independence",
    question: "How independently should contributors be able to release and maintain additions?",
    description:
      "This measures dependence on the core team's release queue. Validation ownership is recorded separately.",
    levels: [
      "The core team implements and releases every addition",
      "Contributors submit changes; the team reviews and releases",
      "Authors maintain contributions with regular core-team involvement",
      "Independent releases with limited curation or integration support",
      "Self-service creation, distribution, and maintenance without core releases",
    ],
  },
] as const;

export type DimensionId = (typeof dimensions)[number]["id"];
export type Scores = Record<DimensionId, number>;
export type Answer = {
  value: number | null;
  importance: number;
  mode: "minimum" | "target";
  unresolved: boolean;
  note: string;
};
export type Answers = Record<DimensionId, Answer>;

export const resources = [
  {
    id: "investment",
    label: "Platform build investment",
    low: "Small integration changes",
    high: "A multi-phase extension platform",
    detail: "Relative new platform work, not total effort to implement every requested device.",
  },
  {
    id: "maintenance",
    label: "Ongoing core-team workload",
    low: "Occasional contract maintenance",
    high: "Continuous implementation, review, and support",
    detail:
      "Includes repeated contribution/release work; a cheap platform may still create a large team bottleneck.",
  },
  {
    id: "creatorSkill",
    label: "Creator technical skill",
    low: "Configuration skills",
    high: "Experienced software/hardware development",
    detail: "Who must implement the capability, including the core team in the internal-only path.",
  },
  {
    id: "operations",
    label: "Distribution service operations",
    low: "Existing release/repository infrastructure",
    high: "Public catalog, accounts, builds, moderation, and incident response",
    detail: "A relative operating commitment, not an infrastructure quote.",
  },
] as const;
export type ResourceId = (typeof resources)[number]["id"];

export const policies = [
  {
    id: "code",
    label: "Independent contributed code",
    question:
      "Should the scope allow contributed executable modules or external adapters, rather than only data profiles or reviewed core changes?",
  },
  {
    id: "host",
    label: "Contributor full host access",
    question: "Should the design support contributed code with privileged host access?",
  },
  {
    id: "drivers",
    label: "Drivers without core releases",
    question: "Must new drivers be usable without merging and releasing the core app?",
  },
  {
    id: "publicLibrary",
    label: "Public self-service library",
    question: "Must a public catalog and self-service publishing be part of the scope?",
  },
  {
    id: "offline",
    label: "Offline operation",
    question: "Must installed capabilities work without contacting our library?",
  },
] as const;
export type PolicyId = (typeof policies)[number]["id"];
export type Constraint = "unspecified" | "required" | "excluded";

export type Approach = {
  id: string;
  name: string;
  short: string;
  color: string;
  contribution: string;
  advantage: string;
  limitation: string;
  scores: Scores;
  rationale: Record<DimensionId, string>;
  requirements: Record<ResourceId, number>;
  features: Record<PolicyId, boolean | null>;
  confidence: "Low" | "Medium";
  note: string;
};

const scores = (
  breadth: number,
  guidance: number,
  authoring: number,
  ui: number,
  distribution: number,
  validation: number,
  lifecycle: number,
  autonomy: number,
): Scores => ({
  breadth,
  guidance,
  authoring,
  interface: ui,
  distribution,
  validation,
  lifecycle,
  autonomy,
});
const reasons = (items: string[]): Record<DimensionId, string> =>
  Object.fromEntries(dimensions.map((dimension, index) => [dimension.id, items[index]])) as Record<
    DimensionId,
    string
  >;

export const initialApproaches: Approach[] = [
  {
    id: "internal",
    name: "We develop everything ourselves",
    short: "Core team",
    color: "#64748b",
    contribution: "Users request capabilities; our team implements and ships them in the core app.",
    advantage: "Smallest new extension-platform investment and one controlled release process.",
    limitation: "Every new capability remains dependent on the team's time and release queue.",
    scores: scores(1, 5, 1, 1, 1, 4, 4, 1),
    requirements: { investment: 1, maintenance: 5, creatorSkill: 5, operations: 1 },
    features: { code: false, host: false, drivers: false, publicLibrary: false, offline: true },
    confidence: "Medium",
    note: "Low platform investment does not mean low ongoing device-development effort. UI scores describe external contributions; operators can still get a polished built-in experience.",
    rationale: reasons([
      "No external extension contract is offered.",
      "The team can ship integrated, guided built-in experiences.",
      "No external creator tooling is assumed.",
      "Users cannot add their own interface through a module.",
      "Capabilities arrive with app releases.",
      "Assumes core-team review and release regression checks; actual depth must be agreed.",
      "Assumes the existing app update and recovery path is maintained.",
      "All implementation and releases depend on the core team.",
    ]),
  },
  {
    id: "core-prs",
    name: "Community contributions to core",
    short: "Core contributions",
    color: "#0284c7",
    contribution: "Drivers, devices, and workflow blocks contributed through pull requests.",
    advantage: "Low platform investment; our team reviews and releases everything.",
    limitation: "The core team remains the review and release bottleneck.",
    scores: scores(5, 4, 2, 5, 1, 4, 4, 2),
    requirements: { investment: 2, maintenance: 5, creatorSkill: 5, operations: 1 },
    features: { code: false, host: false, drivers: false, publicLibrary: false, offline: true },
    confidence: "Medium",
    note: "A pull request can change almost any core feature, but that is not an independently installed module. Host access here means independently contributed runtime code, not reviewed core source.",
    rationale: reasons([
      "Core-source contributions can add drivers, protocols, blocks, and UI.",
      "Merged contributions use the existing guided app experience; polish depends on review.",
      "Assumes contribution guides, examples, and repository tooling.",
      "Contributors can propose new core views and editors.",
      "Accepted work still ships through the core release process.",
      "Core maintainers gate review and test checks.",
      "Contributions inherit the app lifecycle rather than a separate module lifecycle.",
      "Authors can contribute but cannot bypass core review/release ownership.",
    ]),
  },
  {
    id: "profiles",
    name: "Declarative device profiles",
    short: "Device profiles",
    color: "#059669",
    contribution:
      "Configuration, mappings, setup guides, and starter workflows for existing protocols.",
    advantage: "Many devices become supportable without running contributed code.",
    limitation: "Cannot introduce a new driver or protocol.",
    scores: scores(2, 4, 2, 3, 2, 3, 3, 3),
    requirements: { investment: 2, maintenance: 3, creatorSkill: 2, operations: 2 },
    features: { code: false, host: false, drivers: false, publicLibrary: false, offline: true },
    confidence: "Medium",
    note: "Assumes schema-defined configuration and manual profile sharing. A hosted catalog or visual authoring form would be extra scope.",
    rationale: reasons([
      "The contribution is data for existing protocols, not a new executable driver.",
      "Profiles can generate guided configuration and setup instructions.",
      "Assumes schemas/examples; no full in-app editor is included.",
      "Fields, guides, and wizard metadata can be declared.",
      "Profile import/export and repository/file sharing are assumed.",
      "Schemas and repeatable configuration checks are feasible; behavior still needs testing.",
      "Profile versions and saved configuration can be tracked without executable package migrations.",
      "Authors can maintain profiles, but new protocol support still depends on the team.",
    ]),
  },
  {
    id: "adapters",
    name: "External adapters",
    short: "External adapters",
    color: "#d97706",
    contribution: "Separate services exposing hardware through HTTP or MQTT.",
    advantage: "Contributors choose their language and dependencies; Edge Studio stays simpler.",
    limitation: "Installing and operating the adapter adds work for users.",
    scores: scores(4, 2, 2, 1, 2, 2, 2, 4),
    requirements: { investment: 2, maintenance: 2, creatorSkill: 5, operations: 2 },
    features: { code: true, host: null, drivers: true, publicLibrary: false, offline: true },
    confidence: "Low",
    note: "Assumes locally running adapters and documented HTTP/MQTT contracts. Adapter installation, privileges, and validation vary by deployment; full host access needs discussion.",
    rationale: reasons([
      "Adapters can implement new drivers and protocols behind existing transports.",
      "Users must install/configure another service.",
      "Examples and adapter contracts are assumed; contributors use external tools.",
      "The app uses its existing HTTP/MQTT interface.",
      "Adapter artifacts are shared separately, without an app package catalog.",
      "Assumes author/manual integration tests, not a central qualification service.",
      "The user or adapter operator handles service updates and recovery.",
      "Adapters can be released independently of core changes.",
    ]),
  },
  {
    id: "packages",
    name: "Curated extension packages",
    short: "Curated packages",
    color: "#db2777",
    contribution: "Executable integrations installed through a small package manager.",
    advantage: "Independent releases without an in-app editor or public marketplace.",
    limitation: "Still requires runtime contracts, compatibility checks, and recovery.",
    scores: scores(4, 3, 2, 3, 3, 3, 4, 4),
    requirements: { investment: 3, maintenance: 3, creatorSkill: 4, operations: 2 },
    features: { code: true, host: null, drivers: true, publicLibrary: false, offline: true },
    confidence: "Low",
    note: "Assumes reviewed packages, metadata-driven UI, and a real installer. Runtime permissions and custom UI are unspecified, not guaranteed.",
    rationale: reasons([
      "Executable package handlers can add drivers and workflow behavior.",
      "The installer helps, but rich setup guidance is not guaranteed.",
      "Authors use documentation/templates and their own editor.",
      "Assumes metadata-driven forms and guides; custom views are extra work.",
      "Packages are versioned and installed independently; no public marketplace is included.",
      "Assumes a curated review process and repeatable package checks.",
      "Compatibility, dependencies, pinned versions, and recovery are necessary package-manager work.",
      "Authors release independently, subject to curation and contract compatibility.",
    ]),
  },
  {
    id: "sdk",
    name: "Developer SDK and CLI",
    short: "SDK and CLI",
    color: "#4f46e5",
    contribution: "Modules built externally with templates, validation, and packaging tools.",
    advantage: "Tests developer demand before investing in an in-app authoring experience.",
    limitation: "Requires developer skills and is less accessible to ordinary users.",
    scores: scores(4, 2, 3, 3, 3, 3, 3, 4),
    requirements: { investment: 3, maintenance: 3, creatorSkill: 5, operations: 2 },
    features: { code: true, host: null, drivers: true, publicLibrary: false, offline: true },
    confidence: "Low",
    note: "An SDK is authoring infrastructure, not a runtime by itself. This profile assumes a minimal import/runtime contract; combine it with curated packages if appropriate. Host permission policy is unresolved.",
    rationale: reasons([
      "SDK contracts can expose executable integration points.",
      "The path targets developers, with more manual operator setup assumed.",
      "Templates, CLI validation, packaging, and examples are explicit scope.",
      "Assumes schema-based forms and guides; no arbitrary view system is promised.",
      "Build/import independent artifacts; a public catalog is not assumed.",
      "CLI checks and integration tests validate contracts, not all hardware behavior.",
      "A minimal compatible package runtime is assumed; managed recovery needs extra scope.",
      "External authors can build and version modules without core releases.",
    ]),
  },
  {
    id: "full-builder",
    name: "Full module builder",
    short: "Full builder",
    color: "#7c3aed",
    contribution:
      "The complete planned platform: hardware, device setup, workflow extensions, authoring, and a public library.",
    advantage: "The broadest self-service creation and distribution experience.",
    limitation:
      "Largest platform and ecosystem operating commitment; broad code freedom adds trust responsibilities.",
    scores: scores(5, 5, 5, 5, 5, 3, 5, 5),
    requirements: { investment: 5, maintenance: 4, creatorSkill: 3, operations: 5 },
    features: { code: true, host: true, drivers: true, publicLibrary: true, offline: true },
    confidence: "Low",
    note: "Describes the long-term plan, not the current mockup. Stronger authoring tools do not automatically deliver stronger validation. Full host access reflects the earlier proposed design and is deliberately open to challenge in this workshop.",
    rationale: reasons([
      "The proposed contracts span drivers, protocols, device setup, blocks, and custom UI.",
      "The vision includes discovery, setup, testing, and restoration guidance.",
      "The complete module workspace is explicit planned scope; this does not require building a general-purpose IDE.",
      "Versioned custom UI hooks extend schema-defined experiences.",
      "Public pages, publisher identity, reputation, and independent installation are part of the vision.",
      "The plan includes package checks and testing; full third-party hardware qualification is not established.",
      "The plan includes dependency/version management, preserved state, and recovery.",
      "Authors can create, share, and maintain independent modules, with ecosystem operations still required.",
    ]),
  },
];

export type Workshop = {
  name: string;
  participants: string;
  useCases: string[];
  success: string;
  exclusions: string;
  creators: string;
  operators: string;
  validationOwner: string;
  supportOwner: string;
  environments: string;
  commercial: string;
  decisions: string;
  answers: Answers;
  policies: Record<PolicyId, Constraint>;
  limits: Record<ResourceId, number | null>;
  approaches: Approach[];
};

export function newWorkshop(): Workshop {
  return {
    name: "Module strategy workshop",
    participants: "",
    useCases: ["", "", ""],
    success: "",
    exclusions: "",
    creators: "Not decided",
    operators: "Not decided",
    validationOwner: "Not decided",
    supportOwner: "Not decided",
    environments: "",
    commercial: "Not decided",
    decisions: "",
    answers: Object.fromEntries(
      dimensions.map((dimension) => [
        dimension.id,
        { value: null, importance: 2, mode: "minimum", unresolved: false, note: "" },
      ]),
    ) as Answers,
    policies: {
      code: "unspecified",
      host: "unspecified",
      drivers: "unspecified",
      publicLibrary: "unspecified",
      offline: "unspecified",
    },
    limits: { investment: null, maintenance: null, creatorSkill: null, operations: null },
    approaches: structuredClone(initialApproaches),
  };
}
