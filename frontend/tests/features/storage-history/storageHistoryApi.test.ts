import { afterEach, expect, it, vi } from "vitest";
import { downloadHistoryArchive } from "../../../src/features/storage-history/storageHistoryApi";

afterEach(() => vi.unstubAllGlobals());

it("downloads the re-authenticated history archive and revokes its object URL", async () => {
  const blob = new Blob(["history"]);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
  vi.stubGlobal("fetch", fetchMock);
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:history");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  await downloadHistoryArchive("001234");

  expect(fetchMock).toHaveBeenCalledWith("/api/storage-history/export", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "001234" }),
  });
  expect(createObjectURL).toHaveBeenCalledWith(blob);
  expect(clickSpy).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:history");
});
