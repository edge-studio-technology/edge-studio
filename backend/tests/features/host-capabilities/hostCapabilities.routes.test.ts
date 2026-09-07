import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enableHostSensorCapabilityMock, disableHostMqttCapabilityMock, recordAuditEventMock } = vi.hoisted(() => ({
  enableHostSensorCapabilityMock: vi.fn(),
  disableHostMqttCapabilityMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
}));

vi.mock("../../../src/features/host-capabilities/hostCapabilities.service.js", () => ({
  listHostCapabilities: vi.fn(),
  getHostCameraCapability: vi.fn(),
  getHostGpioCapability: vi.fn(),
  getHostSensorCapability: vi.fn(),
  getHostMqttCapability: vi.fn(),
  enableHostCameraCapability: vi.fn(),
  disableHostCameraCapability: vi.fn(),
  enableHostGpioCapability: vi.fn(),
  disableHostGpioCapability: vi.fn(),
  enableHostMqttCapability: vi.fn(),
  disableHostMqttCapability: disableHostMqttCapabilityMock,
  enableHostSensorCapability: enableHostSensorCapabilityMock,
  disableHostSensorCapability: vi.fn(),
}));

vi.mock("../../../src/features/auth/audit.service.js", () => ({
  recordAuditEvent: recordAuditEventMock,
}));

vi.mock("../../../src/features/auth/auth.middleware.js", () => ({
  requireRole: () => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    return next();
  },
}));

const { hostCapabilitiesRouter } = await import("../../../src/features/host-capabilities/hostCapabilities.routes.js");

function testApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: "user-1", displayName: "Admin", role: "admin", lastLogin: null, credentialType: "pin" };
    next();
  });
  app.use("/api/host-capabilities", hostCapabilitiesRouter);
  return app;
}

describe("hostCapabilities.routes", () => {
  beforeEach(() => {
    enableHostSensorCapabilityMock.mockReset();
    disableHostMqttCapabilityMock.mockReset();
    recordAuditEventMock.mockReset();
  });

  it("records a sanitized audit event after enabling hardware support", async () => {
    enableHostSensorCapabilityMock.mockResolvedValue({
      capability: { name: "sensors", enabled: true, installed: true, available: true, state: "enabled", reason: null },
      restart: { ok: true, scheduled: true },
    });

    await request(testApp()).post("/api/host-capabilities/sensors/enable").expect(200);

    expect(recordAuditEventMock).toHaveBeenCalledWith("host-capability.enable", {
      userId: "user-1",
      detail: "capability=sensors state=enabled enabled=true available=true",
    });
  });

  it("records resulting state after disabling hardware support", async () => {
    disableHostMqttCapabilityMock.mockResolvedValue({
      capability: { name: "mqtt", enabled: false, installed: false, available: false, state: "disabled", reason: "disabled" },
    });

    await request(testApp()).post("/api/host-capabilities/mqtt/disable").expect(200);

    expect(recordAuditEventMock).toHaveBeenCalledWith("host-capability.disable", {
      userId: "user-1",
      detail: "capability=mqtt state=disabled enabled=false available=false",
    });
  });

  it("does not record an audit event when the host action fails", async () => {
    enableHostSensorCapabilityMock.mockRejectedValue(new Error("/dev/i2c-1 was not found"));

    await request(testApp()).post("/api/host-capabilities/sensors/enable").expect(502);

    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });
});
