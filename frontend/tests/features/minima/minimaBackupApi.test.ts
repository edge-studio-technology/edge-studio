import { afterEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();
const deleteJson = vi.fn();
const postForm = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
  deleteJson: (...args: unknown[]) => deleteJson(...args),
  postForm: (...args: unknown[]) => postForm(...args),
}));

import {
  clearBackupPassword,
  createMinimaBackup,
  deleteMinimaBackup,
  downloadMinimaBackup,
  getAutoBackupEnabled,
  getBackupPasswordStatus,
  listMinimaBackups,
  restoreMinimaBackup,
  restoreMinimaBackupFromUpload,
  setAutoBackupEnabled,
  setBackupPassword,
} from "../../../src/features/minima/minimaBackupApi";

describe("minimaBackupApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("listMinimaBackups GETs /api/minima/backups", async () => {
    getJson.mockResolvedValue([]);
    await listMinimaBackups();
    expect(getJson).toHaveBeenCalledWith("/api/minima/backups");
  });

  it("createMinimaBackup POSTs /api/minima/backups with no body", async () => {
    postJson.mockResolvedValue({ ok: true, fileName: "a.bak", auto: false });
    await createMinimaBackup();
    expect(postJson).toHaveBeenCalledWith("/api/minima/backups");
  });

  it("getBackupPasswordStatus GETs /api/minima/backups/password", async () => {
    getJson.mockResolvedValue({ hasPassword: true });
    await getBackupPasswordStatus();
    expect(getJson).toHaveBeenCalledWith("/api/minima/backups/password");
  });

  it("setBackupPassword POSTs the backup and current password", async () => {
    postJson.mockResolvedValue({ hasPassword: true });
    await setBackupPassword({ backupPassword: "newpw", currentPassword: "pin1234" });
    expect(postJson).toHaveBeenCalledWith("/api/minima/backups/password", {
      backupPassword: "newpw",
      currentPassword: "pin1234",
    });
  });

  it("clearBackupPassword DELETEs with currentPassword", async () => {
    deleteJson.mockResolvedValue({ hasPassword: false });
    await clearBackupPassword("pin1234");
    expect(deleteJson).toHaveBeenCalledWith("/api/minima/backups/password", { currentPassword: "pin1234" });
  });

  it("restoreMinimaBackup POSTs fileName and currentPassword", async () => {
    postJson.mockResolvedValue({ ok: true, source: "minima" });
    await restoreMinimaBackup({ fileName: "a.bak", currentPassword: "pin1234" });
    expect(postJson).toHaveBeenCalledWith("/api/minima/backups/restore", {
      fileName: "a.bak",
      currentPassword: "pin1234",
    });
  });

  it("restoreMinimaBackupFromUpload posts a FormData with file, currentPassword, and optional password", async () => {
    postForm.mockResolvedValue({ ok: true, source: "minima" });
    const file = new File(["data"], "a.bak");
    await restoreMinimaBackupFromUpload({ file, password: "override", currentPassword: "pin1234" });

    expect(postForm).toHaveBeenCalledTimes(1);
    const [url, form] = postForm.mock.calls[0];
    expect(url).toBe("/api/minima/backups/restore");
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("file")).toBe(file);
    expect(form.get("currentPassword")).toBe("pin1234");
    expect(form.get("password")).toBe("override");
  });

  it("restoreMinimaBackupFromUpload omits password when blank", async () => {
    postForm.mockResolvedValue({ ok: true, source: "minima" });
    const file = new File(["data"], "a.bak");
    await restoreMinimaBackupFromUpload({ file, password: "", currentPassword: "pin1234" });

    const [, form] = postForm.mock.calls[0];
    expect(form.get("password")).toBeNull();
  });

  it("deleteMinimaBackup DELETEs the encoded file name", async () => {
    deleteJson.mockResolvedValue({ ok: true });
    await deleteMinimaBackup("my backup.bak");
    expect(deleteJson).toHaveBeenCalledWith("/api/minima/backups/my%20backup.bak");
  });

  it("getAutoBackupEnabled GETs /api/minima/backups/auto", async () => {
    getJson.mockResolvedValue({ autoBackupEnabled: true });
    await getAutoBackupEnabled();
    expect(getJson).toHaveBeenCalledWith("/api/minima/backups/auto");
  });

  it("setAutoBackupEnabled POSTs the enabled flag", async () => {
    postJson.mockResolvedValue({ autoBackupEnabled: false });
    await setAutoBackupEnabled(false);
    expect(postJson).toHaveBeenCalledWith("/api/minima/backups/auto", { enabled: false });
  });

  it("downloadMinimaBackup posts the current password, downloads the blob, and revokes the object URL", async () => {
    const blob = new Blob(["backup"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadMinimaBackup("my backup.bak", "pin1234");

    expect(fetchMock).toHaveBeenCalledWith("/api/minima/backups/my%20backup.bak/download", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "pin1234" }),
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("downloadMinimaBackup throws the parsed error message and errorCode on a failed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Invalid credential", errorCode: "INVALID_PASSWORD" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadMinimaBackup("a.bak", "wrong")).rejects.toMatchObject({
      message: "Invalid credential",
      errorCode: "INVALID_PASSWORD",
    });
  });

  it("downloadMinimaBackup falls back to an HTTP status message when the response has no error field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadMinimaBackup("a.bak", "pin1234")).rejects.toThrow("HTTP 500");
  });
});
