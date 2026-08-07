/** One-pipeline workflow editor: canvas graph + workspace chrome + helpers/inspectors. */

export type {
  DraftWorkflowBlock,
  WorkflowCanvasBlock,
  WorkflowCanvasMode,
  WorkflowCanvasRuntimeState,
  WorkflowCanvasValidationIssue,
} from "./canvas";

export {
  automationBlockToCanvasBlock,
  draftBlockDescription,
  draftBlockTitle,
  isDataBlock,
  WorkflowWorkspaceShell,
  WorkflowRailHeader,
  WorkflowRailPanel,
  WorkflowBlockLibrary,
  WorkflowCanvas,
} from "./canvas";

export {
  DraftBlockInspector,
  PersistedBlockInspector,
  AttachedStampSettings,
} from "./WorkflowBlockInspectors";

export {
  IconAction,
  InspectorSection,
  Panel,
  RuntimeStat,
  SaveState,
  SelectedBlockSheet,
  StatusPill,
  ValidationIssueRow,
  WorkflowStatusPill,
  RulePart,
  cardClass,
  errorText,
  formGridClass,
  inspectorClass,
  mutedText,
  softCardClass,
  statusRowClass,
} from "./workflowWorkspaceUi";

export * from "./workflowHelpers";
