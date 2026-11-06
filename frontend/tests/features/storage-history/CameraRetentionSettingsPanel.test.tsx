import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { CameraRetentionSettingsPanel } from "../../../src/features/storage-history/CameraRetentionSettingsPanel";

const initial = {
  settings: { retentionDays: 7, paused: true },
  camera: { enabled: false, available: true, fileCount: 0, bytes: 0 },
  limits: { min: 1, max: 3650 },
  eligible: { fileCount: 0, bytes: 0 },
  scheduled: { fileCount: 0, bytes: 0 },
  previewToken: "initial",
};
const fetchMock = vi.fn();
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response(initial));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function renderPanel() {
  render(<CameraRetentionSettingsPanel />, { wrapper: ToastProvider });
}

it("explains disabled camera support without retention controls when no captures remain", async () => {
  renderPanel();
  await screen.findByText(/Camera support is disabled. Automatic camera cleanup is paused/);
  expect(
    screen.queryByLabelText("Automatically remove old camera captures"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Stored captures:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Saved camera policy:/)).not.toBeInTheDocument();
});

it("shows remaining storage and saved policy while disabled without allowing cleanup", async () => {
  fetchMock.mockResolvedValue(
    response({ ...initial, camera: { ...initial.camera, fileCount: 3, bytes: 1048576 } }),
  );
  renderPanel();
  expect(await screen.findByText(/Stored captures: 3 \(1.0 MB\)/)).toBeInTheDocument();
  expect(screen.getByText(/Saved camera policy: Delete after 7 days/)).toHaveTextContent(
    "review and confirm",
  );
  expect(
    screen.queryByRole("button", { name: "Preview camera retention" }),
  ).not.toBeInTheDocument();
});

it("requires preview and confirmation to resume a saved policy, and can cancel", async () => {
  const user = userEvent.setup();
  const loaded = { ...initial, camera: { ...initial.camera, enabled: true, fileCount: 4 } };
  const proposal = {
    ...loaded,
    settings: { retentionDays: 30, paused: false },
    scheduled: { fileCount: 2, bytes: 2097152 },
    previewToken: "reviewed",
  };
  fetchMock
    .mockResolvedValueOnce(response(loaded))
    .mockResolvedValueOnce(response(proposal))
    .mockResolvedValueOnce(response(proposal))
    .mockResolvedValueOnce(response(proposal));
  renderPanel();
  const days = await screen.findByLabelText("Camera capture retention (days)");
  expect(screen.getByText(/Saved camera policy:/)).toHaveTextContent("Cleanup is paused");
  await user.clear(days);
  await user.type(days, "30");
  await user.click(screen.getByRole("button", { name: "Preview camera retention" }));
  let modal = await screen.findByRole("dialog");
  expect(within(modal).getByText(/2 files \(2.0 MB\)/)).toBeInTheDocument();
  await user.click(within(modal).getByRole("button", { name: "Cancel" }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Preview camera retention" }));
  modal = await screen.findByRole("dialog");
  await user.click(within(modal).getByRole("button", { name: "Confirm camera policy" }));
  await screen.findByText("Camera retention saved");
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
    settings: { retentionDays: 30, paused: false },
    confirmed: true,
    previewToken: "reviewed",
  });
  expect(screen.getByText(/Saved camera policy:/)).toHaveTextContent("The saved policy is active");
});

it("validates days and supports keep until manually deleted", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockResolvedValueOnce(response({ ...initial, camera: { ...initial.camera, enabled: true } }))
    .mockResolvedValueOnce(
      response({ ...initial, settings: { retentionDays: null, paused: false } }),
    );
  renderPanel();
  const days = await screen.findByLabelText("Camera capture retention (days)");
  await user.clear(days);
  await user.type(days, "0");
  await user.click(screen.getByRole("button", { name: "Preview camera retention" }));
  expect(screen.getByText("Enter a whole number from 1 to 3650.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await user.click(screen.getByLabelText("Automatically remove old camera captures"));
  await user.click(screen.getByRole("button", { name: "Preview camera retention" }));
  await screen.findByRole("dialog");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    retentionDays: null,
    paused: false,
  });
});

it("offers retry for load failures and preserves edits after a stale preview", async () => {
  const user = userEvent.setup();
  fetchMock
    .mockRejectedValueOnce(new Error("Camera settings unavailable"))
    .mockResolvedValueOnce(response({ ...initial, camera: { ...initial.camera, enabled: true } }))
    .mockResolvedValueOnce(response(initial))
    .mockResolvedValueOnce(response({ error: "Review a new preview." }, 409));
  renderPanel();
  await screen.findByText("Camera settings unavailable");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByLabelText("Camera capture retention (days)");
  await user.click(screen.getByRole("button", { name: "Preview camera retention" }));
  const modal = await screen.findByRole("dialog");
  await user.click(within(modal).getByRole("button", { name: "Confirm camera policy" }));
  await screen.findByText("Review a new preview.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Camera capture retention (days)")).toHaveValue(7);
});
