import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { MinimaBackupPanel } from "../../../src/features/minima/MinimaBackupPanel";

const clearBackupPassword = vi.fn();
const createMinimaBackup = vi.fn();
const deleteMinimaBackup = vi.fn();
const downloadMinimaBackup = vi.fn();
const getAutoBackupEnabled = vi.fn();
const getBackupPasswordStatus = vi.fn();
const listMinimaBackups = vi.fn();
const restoreMinimaBackup = vi.fn();
const restoreMinimaBackupFromUpload = vi.fn();
const setAutoBackupEnabled = vi.fn();
const setBackupPassword = vi.fn();

vi.mock("../../../src/features/minima/minimaBackupApi", () => ({
  clearBackupPassword: (...args: unknown[]) => clearBackupPassword(...args),
  createMinimaBackup: (...args: unknown[]) => createMinimaBackup(...args),
  deleteMinimaBackup: (...args: unknown[]) => deleteMinimaBackup(...args),
  downloadMinimaBackup: (...args: unknown[]) => downloadMinimaBackup(...args),
  getAutoBackupEnabled: (...args: unknown[]) => getAutoBackupEnabled(...args),
  getBackupPasswordStatus: (...args: unknown[]) => getBackupPasswordStatus(...args),
  listMinimaBackups: (...args: unknown[]) => listMinimaBackups(...args),
  restoreMinimaBackup: (...args: unknown[]) => restoreMinimaBackup(...args),
  restoreMinimaBackupFromUpload: (...args: unknown[]) => restoreMinimaBackupFromUpload(...args),
  setAutoBackupEnabled: (...args: unknown[]) => setAutoBackupEnabled(...args),
  setBackupPassword: (...args: unknown[]) => setBackupPassword(...args),
}));

const backups = [
  { fileName: "minima-manual-1.bak", sizeBytes: 2048, createdAt: "2026-08-19T00:00:00.000Z" },
  { fileName: "minima-auto-2.bak", sizeBytes: 5 * 1024 * 1024, createdAt: "2026-08-20T00:00:00.000Z" },
];

function renderPanel(minimaState: "running" | "stopped" | "error" | "restarting" | null = "running") {
  return render(<MinimaBackupPanel minimaState={minimaState} />, { wrapper: ToastProvider });
}

function getFileInput() {
  // Modal content is portaled to document.body, so query from there rather than
  // the render() container.
  const input = document.body.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("MinimaBackupPanel", () => {
  beforeEach(() => {
    clearBackupPassword.mockReset();
    createMinimaBackup.mockReset();
    deleteMinimaBackup.mockReset();
    downloadMinimaBackup.mockReset();
    getAutoBackupEnabled.mockReset().mockResolvedValue({ autoBackupEnabled: false });
    getBackupPasswordStatus.mockReset().mockResolvedValue({ hasPassword: true });
    listMinimaBackups.mockReset().mockResolvedValue(backups);
    restoreMinimaBackup.mockReset();
    restoreMinimaBackupFromUpload.mockReset();
    setAutoBackupEnabled.mockReset();
    setBackupPassword.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading, then the backup list with formatted sizes and counts", async () => {
    renderPanel();
    expect(await screen.findByText("Backups (2/20)")).toBeInTheDocument();
    expect(screen.getByText("minima-manual-1.bak")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
  });

  it("shows a list error when the initial fetch fails", async () => {
    listMinimaBackups.mockRejectedValue(new Error("list down"));
    renderPanel();
    expect(await screen.findByText("list down")).toBeInTheDocument();
  });

  it("shows an empty state when there are no backups", async () => {
    listMinimaBackups.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("None yet.")).toBeInTheDocument();
  });

  it("shows a no-password notice when hasPassword is false, disabling backup now / auto backups", async () => {
    getBackupPasswordStatus.mockResolvedValue({ hasPassword: false });
    renderPanel();
    expect(await screen.findByText(/No backup password set/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /backup now/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /auto backups/i })).toBeDisabled();
  });

  it("creates a backup and refreshes the list", async () => {
    const user = userEvent.setup();
    createMinimaBackup.mockResolvedValue({ ok: true, source: "minima", fileName: "new.bak", auto: false });
    renderPanel();

    await screen.findByText("Backups (2/20)");
    await user.click(screen.getByRole("button", { name: /backup now/i }));

    await waitFor(() => expect(createMinimaBackup).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Backup created")).toBeInTheDocument();
    expect(listMinimaBackups).toHaveBeenCalledTimes(2);
  });

  it("shows a toast when backup creation fails", async () => {
    const user = userEvent.setup();
    createMinimaBackup.mockRejectedValue(new Error("backup boom"));
    renderPanel();

    await screen.findByText("Backups (2/20)");
    await user.click(screen.getByRole("button", { name: /backup now/i }));
    expect(await screen.findByText("Backup failed")).toBeInTheDocument();
  });

  it("toggles auto backup on and off", async () => {
    const user = userEvent.setup();
    setAutoBackupEnabled.mockResolvedValue({ autoBackupEnabled: true });
    renderPanel();

    const toggle = await screen.findByRole("checkbox", { name: /auto backups/i });
    await user.click(toggle);
    await waitFor(() => expect(setAutoBackupEnabled).toHaveBeenCalledWith(true));
  });

  it("shows a toast when toggling auto backup fails", async () => {
    const user = userEvent.setup();
    setAutoBackupEnabled.mockRejectedValue(new Error("toggle failed"));
    renderPanel();

    const toggle = await screen.findByRole("checkbox", { name: /auto backups/i });
    await user.click(toggle);
    expect(await screen.findByText("Failed to update auto-backup")).toBeInTheDocument();
  });

  it("deletes a backup via row menu -> confirm, showing a progress modal then refreshing", async () => {
    const user = userEvent.setup();
    deleteMinimaBackup.mockResolvedValue({ ok: true });
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /more actions for minima-manual-1.bak/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(screen.getByRole("heading", { name: "Delete backup" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete backup/i }));

    await waitFor(() => expect(deleteMinimaBackup).toHaveBeenCalledWith("minima-manual-1.bak"));
    await waitFor(() => expect(listMinimaBackups).toHaveBeenCalledTimes(2));
  });

  it("shows a toast when delete fails", async () => {
    const user = userEvent.setup();
    deleteMinimaBackup.mockRejectedValue(new Error("delete failed"));
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /more actions for minima-manual-1.bak/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /delete backup/i }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
  });

  it("downloads a backup after confirming with the current password", async () => {
    const user = userEvent.setup();
    downloadMinimaBackup.mockResolvedValue(undefined);
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: "Download minima-manual-1.bak" }));

    const passwordInput = screen.getByLabelText(/current pin or password/i);
    await user.type(passwordInput, "pin1234");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() =>
      expect(downloadMinimaBackup).toHaveBeenCalledWith("minima-manual-1.bak", "pin1234"),
    );
  });

  it("shows a download error when the password is invalid", async () => {
    const user = userEvent.setup();
    downloadMinimaBackup.mockRejectedValue(new Error("Invalid credential"));
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: "Download minima-manual-1.bak" }));
    await user.type(screen.getByLabelText(/current pin or password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(await screen.findByText("Invalid credential")).toBeInTheDocument();
  });

  it("requires a download credential and locks the modal while confirming", async () => {
    const user = userEvent.setup();
    downloadMinimaBackup.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: "Download minima-manual-1.bak" }));
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(screen.getByRole("button", { name: "Confirming…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(downloadMinimaBackup).toHaveBeenCalledOnce();
  });

  it("restores a backup from a row's menu after confirming with the current password", async () => {
    const user = userEvent.setup();
    restoreMinimaBackup.mockResolvedValue({ ok: true, source: "minima" });
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /more actions for minima-manual-1.bak/i }));
    await user.click(screen.getByRole("menuitem", { name: /restore/i }));

    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /confirm restore/i }));

    await waitFor(() =>
      expect(restoreMinimaBackup).toHaveBeenCalledWith({
        fileName: "minima-manual-1.bak",
        currentPassword: "pin1234",
      }),
    );
    expect(await screen.findByText("Restore started")).toBeInTheDocument();
  });

  it("disables row Restore when the node isn't confirmed running", async () => {
    renderPanel("stopped");
    await screen.findByText("minima-manual-1.bak");
    await userEvent.setup().click(
      screen.getByRole("button", { name: /more actions for minima-manual-1.bak/i }),
    );
    expect(screen.getByRole("menuitem", { name: /restore/i })).toBeDisabled();
  });

  it("requires a row-restore credential and locks the modal while restoring", async () => {
    const user = userEvent.setup();
    restoreMinimaBackup.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /more actions for minima-manual-1.bak/i }));
    await user.click(screen.getByRole("menuitem", { name: /restore/i }));
    expect(screen.getByRole("button", { name: /confirm restore/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /confirm restore/i }));
    expect(screen.getByRole("button", { name: "Restoring…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(restoreMinimaBackup).toHaveBeenCalledOnce();
  });

  it("uploads a .bak file and restores from it", async () => {
    const user = userEvent.setup();
    restoreMinimaBackupFromUpload.mockResolvedValue({ ok: true, source: "minima" });
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /restore from backup/i }));

    const file = new File(["backup-bytes"], "restore.bak");
    await userEvent.upload(getFileInput(), file);

    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^restore$/i }));

    await waitFor(() =>
      expect(restoreMinimaBackupFromUpload).toHaveBeenCalledWith({
        file,
        password: "",
        currentPassword: "pin1234",
      }),
    );
    expect(await screen.findByText("Restore started")).toBeInTheDocument();
  });

  it("shows an upload-restore error on failure", async () => {
    const user = userEvent.setup();
    restoreMinimaBackupFromUpload.mockRejectedValue(new Error("bad file"));
    renderPanel();

    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /restore from backup/i }));
    await userEvent.upload(getFileInput(), new File(["x"], "restore.bak"));
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^restore$/i }));

    expect(await screen.findByText("bad file")).toBeInTheDocument();
  });

  it("requires an upload and credential and locks the modal while restoring", async () => {
    const user = userEvent.setup();
    restoreMinimaBackupFromUpload.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByText("minima-manual-1.bak");
    await user.click(screen.getByRole("button", { name: /restore from backup/i }));
    expect(screen.getByRole("button", { name: /^restore$/i })).toBeDisabled();
    await user.upload(getFileInput(), new File(["x"], "restore.bak"));
    expect(screen.getByRole("button", { name: /^restore$/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^restore$/i }));
    expect(screen.getByRole("button", { name: "Restoring…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(restoreMinimaBackupFromUpload).toHaveBeenCalledOnce();
  });

  it("sets a backup password via the key icon modal", async () => {
    const user = userEvent.setup();
    getBackupPasswordStatus.mockResolvedValue({ hasPassword: false });
    setBackupPassword.mockResolvedValue({ hasPassword: true });
    renderPanel();

    await screen.findByText(/No backup password set/);
    await user.click(screen.getByRole("button", { name: /set backup password/i }));

    await user.type(screen.getByLabelText(/^backup password$/i), "newpw1234");
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /save backup password/i }));

    await waitFor(() =>
      expect(setBackupPassword).toHaveBeenCalledWith({
        backupPassword: "newpw1234",
        currentPassword: "pin1234",
      }),
    );
    expect(await screen.findByText("Backup password saved")).toBeInTheDocument();
  });

  it("removes the backup password via the manage-password -> remove flow", async () => {
    const user = userEvent.setup();
    clearBackupPassword.mockResolvedValue({ hasPassword: false });
    renderPanel();

    await screen.findByText("Backups (2/20)");
    await user.click(screen.getByRole("button", { name: /manage backup password/i }));
    await user.click(screen.getByRole("button", { name: /remove backup password/i }));

    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^remove password$/i }));

    await waitFor(() => expect(clearBackupPassword).toHaveBeenCalledWith("pin1234"));
    expect(await screen.findByText("Backup password removed")).toBeInTheDocument();
  });

  it("requires the current credential and locks the modal while removing the password", async () => {
    const user = userEvent.setup();
    clearBackupPassword.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByText("Backups (2/20)");
    await user.click(screen.getByRole("button", { name: /manage backup password/i }));
    await user.click(screen.getByRole("button", { name: /remove backup password/i }));
    expect(screen.getByRole("button", { name: /^remove password$/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/current pin or password/i), "pin1234");
    await user.click(screen.getByRole("button", { name: /^remove password$/i }));
    expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(clearBackupPassword).toHaveBeenCalledOnce();
  });

  it("renders bare content without the panel heading when bare is set", async () => {
    render(<MinimaBackupPanel bare minimaState="running" />, { wrapper: ToastProvider });
    await screen.findByText("Backups (2/20)");
    expect(screen.queryByText("Node backup & restore")).not.toBeInTheDocument();
  });
});
