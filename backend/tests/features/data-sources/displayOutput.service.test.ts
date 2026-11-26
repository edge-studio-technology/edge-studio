import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ displaysEnabled: true, displayHelperUrl: "http://display-helper", displayHelperToken: "display-token" }));
const getDataSource = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/env.js", () => ({ env }));
vi.mock("../../../src/features/data-sources/dataSources.repository.js", () => ({ getDataSource }));
import { displayText, getDisplayCapability } from "../../../src/features/data-sources/displayOutput.service.js";
import { parseSpiDisplayConfig } from "../../../src/features/data-sources/dataSources.service.js";

const fetchMock = vi.fn();
beforeEach(() => {
  env.displaysEnabled = true;
  env.displayHelperToken = "display-token";
  getDataSource.mockReturnValue({ id: "screen", name: "Desk screen", type: "spi-display", config: '{"model":"pim576","rotation":90}' });
  fetchMock.mockReset().mockResolvedValue(new Response('{}'));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("SPI display output", () => {
  it("validates the fixed model and rotation without accepting generic hardware commands", () => {
    expect(parseSpiDisplayConfig({})).toEqual({ model: "pim576", rotation: 0 });
    expect(parseSpiDisplayConfig({ rotation: 270 })).toEqual({ model: "pim576", rotation: 270 });
    expect(() => parseSpiDisplayConfig({ model: "unknown" })).toThrow(/model/);
    for (const rotation of [1, "90", true, 360]) expect(() => parseSpiDisplayConfig({ rotation })).toThrow(/rotation/);
  });

  it("sends authenticated text/config and returns a history-friendly result", async () => {
    const result = await displayText({ targetId: "screen", payload: { title: "Status", text: "Workflow message" } });
    expect(fetchMock).toHaveBeenCalledWith("http://display-helper/display", expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer display-token", "Content-Type": "application/json" } }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ config: { model: "pim576", rotation: 90 }, content: { title: "Status", text: "Workflow message" } });
    expect(result).toMatchObject({ targetId: "screen", targetName: "Desk screen", action: "display_text", title: "Status", text: "Workflow message" });
    expect(result.updatedAt).toMatch(/^\d{4}-/);
  });

  it("blocks disabled support, missing tokens and non-display targets before network access", async () => {
    env.displaysEnabled = false;
    expect(await getDisplayCapability()).toMatchObject({ enabled: false, available: false });
    await expect(displayText({ targetId: "screen", payload: { text: "Hi" } })).rejects.toThrow(/disabled/);
    env.displaysEnabled = true;
    env.displayHelperToken = "";
    await expect(displayText({ targetId: "screen", payload: { text: "Hi" } })).rejects.toThrow(/not configured/);
    env.displayHelperToken = "display-token";
    getDataSource.mockReturnValue({ type: "json-api" });
    await expect(displayText({ targetId: "screen", payload: { text: "Hi" } })).rejects.toThrow(/display target/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { text: 12 }, { text: " " }, { text: "x".repeat(513) }, { text: "Hi", title: "bad\nline" }])("rejects invalid text before hardware access: %j", async (payload) => {
    await expect(displayText({ targetId: "screen", payload })).rejects.toThrow(/payload/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates helper render failures and reports unavailable capabilities", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"Display text does not fit"}', { status: 400 }));
    await expect(displayText({ targetId: "screen", payload: { text: "Hi" } })).rejects.toThrow(/does not fit/);
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));
    expect(await getDisplayCapability()).toMatchObject({ enabled: true, available: false });
    fetchMock.mockResolvedValueOnce(new Response('{"available":true,"supportedModels":["pim576"]}'));
    expect(await getDisplayCapability()).toMatchObject({ available: true, supportedModels: ["pim576"] });
  });
});
