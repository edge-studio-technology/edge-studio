import { afterEach, describe, expect, it, vi } from "vitest";

const getJson = vi.fn();
const postJson = vi.fn();

vi.mock("../../../src/lib/api", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

import {
  getConsoleWhitelist,
  runConsoleCommand,
  updateConsoleWhitelist,
} from "../../../src/features/minima/minimaConsoleApi";

describe("minimaConsoleApi", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("getConsoleWhitelist GETs /api/minima/console/whitelist", async () => {
    getJson.mockResolvedValue({ catalog: [], enabledKeys: [] });
    await getConsoleWhitelist();
    expect(getJson).toHaveBeenCalledWith("/api/minima/console/whitelist");
  });

  it("updateConsoleWhitelist POSTs enabledKeys and currentPassword", async () => {
    postJson.mockResolvedValue({ catalog: [], enabledKeys: ["status"] });
    await updateConsoleWhitelist(["status"], "pin1234");
    expect(postJson).toHaveBeenCalledWith("/api/minima/console/whitelist", {
      enabledKeys: ["status"],
      currentPassword: "pin1234",
    });
  });

  it("runConsoleCommand POSTs the command", async () => {
    postJson.mockResolvedValue({ ok: true, source: "minima" });
    await runConsoleCommand("status");
    expect(postJson).toHaveBeenCalledWith("/api/minima/console/run", { command: "status" });
  });
});
