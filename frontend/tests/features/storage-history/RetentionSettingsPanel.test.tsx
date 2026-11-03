import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { RetentionSettingsPanel } from "../../../src/features/storage-history/RetentionSettingsPanel";

const settings = {
  automaticCleanupEnabled: false,
  runsPerWorkflow: 500,
  deletedWorkflowRunDays: 90,
  dataSourceReadDays: 90,
  diskWarningPercent: 80,
  inboxRetentionDays: null,
};
const limits = {
  runsPerWorkflow: { min: 50, max: 10000 },
  deletedWorkflowRunDays: { min: 7, max: 3650 },
  dataSourceReadDays: { min: 7, max: 3650 },
  diskWarningPercent: { min: 50, max: 95 },
  inboxRetentionDays: { min: 7, max: 3650 },
};
const zero = {
  automationRuns: 0,
  automationBlockRuns: 0,
  dataSourceReads: 0,
  automationInboxItems: 0,
};
const counts = {
  automationRuns: 3,
  automationBlockRuns: 6,
  dataSourceReads: 8,
  automationInboxItems: 0,
};
const initial = {
  settings,
  limits,
  eligible: counts,
  scheduled: zero,
  previewToken: "initial",
  diskUsage: { usedPercent: 85, warning: true },
};
const proposal = {
  settings: { ...settings, automaticCleanupEnabled: true },
  eligible: counts,
  scheduled: counts,
  previewToken: "reviewed",
};
const fetchMock = vi.fn();
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(() => Promise.resolve(response(initial)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("keeps automatic cleanup off by default and reports the saved disk warning", async () => {
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  expect(await screen.findByLabelText("Runs to keep per workflow")).toHaveValue(500);
  expect(screen.getByLabelText("Enable automatic run and read cleanup")).not.toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent("Disk warning threshold reached");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Automatically remove old inbox items")).not.toBeChecked();
  expect(screen.getByText(/Saved inbox policy: Keep until manually deleted/)).toBeInTheDocument();
  expect(screen.queryByLabelText("Inbox item retention (days)")).not.toBeInTheDocument();
});

it("previews and confirms inbox retention independently from run and read cleanup", async () => {
  const user = userEvent.setup();
  const inboxProposal = {
    ...proposal,
    settings: { ...settings, inboxRetentionDays: 30 },
    scheduled: { ...zero, automationInboxItems: 12 },
    previewToken: "inbox-reviewed",
  };
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response(inboxProposal))
    .mockResolvedValueOnce(response(inboxProposal));
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByLabelText("Runs to keep per workflow");
  await user.click(screen.getByLabelText("Automatically remove old inbox items"));
  const days = screen.getByLabelText("Inbox item retention (days)");
  await user.clear(days);
  await user.type(days, "30");
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).getByText(/Inbox items: 12/)).toBeInTheDocument();
  expect(within(modal).getByText(/Delete read and unread items after 30 days/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    automaticCleanupEnabled: false,
    inboxRetentionDays: 30,
  });
  await user.click(within(modal).getByRole("button", { name: "Confirm and save policy" }));
  await screen.findByText("Retention policy saved");
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).settings.inboxRetentionDays).toBe(30);
  expect(screen.getByLabelText("Enable automatic run and read cleanup")).not.toBeChecked();
});

it("validates inbox age and sends null when its policy is turned off", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response({ ...proposal, settings, scheduled: zero }));
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByLabelText("Runs to keep per workflow");
  await user.click(screen.getByLabelText("Automatically remove old inbox items"));
  const days = screen.getByLabelText("Inbox item retention (days)");
  await user.clear(days);
  await user.type(days, "1");
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  expect(screen.getByText("Enter a whole number from 7 to 3650.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await user.click(screen.getByLabelText("Automatically remove old inbox items"));
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  await screen.findByRole("dialog");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).inboxRetentionDays).toBeNull();
});

it("previews deletion counts and saves only after confirmation", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response(proposal))
    .mockResolvedValueOnce(response(proposal));
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByLabelText("Runs to keep per workflow");
  await user.click(screen.getByLabelText("Enable automatic run and read cleanup"));
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  const modal = await screen.findByRole("dialog");
  expect(
    within(modal).getByText(/3 workflow runs, 6 block runs, and 8 data-source reads/),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/retention/settings/preview");
  await user.click(within(modal).getByRole("button", { name: "Confirm and save policy" }));
  await screen.findByText("Retention policy saved");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/retention/settings");
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
    settings: proposal.settings,
    previewToken: "reviewed",
    confirmed: true,
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("cancels a preview without saving", async () => {
  const user = userEvent.setup();
  fetchMock.mockResolvedValueOnce(response(initial)).mockResolvedValueOnce(response(proposal));
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByLabelText("Runs to keep per workflow");
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  const modal = await screen.findByRole("dialog");
  await user.click(within(modal).getByRole("button", { name: "Cancel" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("rejects invalid retention values before requesting a preview", async () => {
  const user = userEvent.setup();
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  const field = await screen.findByLabelText("Data-source read retention (days)");
  await user.clear(field);
  await user.type(field, "1");
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  expect(screen.getByText("Enter a whole number from 7 to 3650.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("requires a fresh preview after a save conflict and keeps the edited policy", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response(proposal))
    .mockResolvedValueOnce(
      response({ error: "Record counts changed; review a fresh preview." }, 409),
    );
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByLabelText("Runs to keep per workflow");
  await user.click(screen.getByLabelText("Enable automatic run and read cleanup"));
  await user.click(screen.getByRole("button", { name: "Preview retention changes" }));
  const modal = await screen.findByRole("dialog");
  await user.click(within(modal).getByRole("button", { name: "Confirm and save policy" }));
  await screen.findByText("Record counts changed; review a fresh preview.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Enable automatic run and read cleanup")).toBeChecked();
});

it("offers retry after a load error", async () => {
  const user = userEvent.setup();
  fetchMock.mockRejectedValueOnce(new Error("Settings unavailable"));
  render(<RetentionSettingsPanel />, { wrapper: ToastProvider });
  await screen.findByText("Settings unavailable");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByLabelText("Runs to keep per workflow")).toHaveValue(500);
});
