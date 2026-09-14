import { describe, expect, it } from "vitest";
import { integritasErrorToast } from "../../../src/features/integritas/integritasErrors";

describe("integritasErrorToast", () => {
  it("maps unauthorized to an API-key-rejected toast", () => {
    const error = Object.assign(new Error("nope"), { errorCode: "unauthorized" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas API key rejected",
      message: "Integritas rejected this device’s API key. Reconnect on the Integritas page.",
    });
  });

  it("maps payment_required to a plan-limit toast", () => {
    const error = Object.assign(new Error("nope"), { errorCode: "payment_required" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas plan limit reached",
      message: "Upgrade your Integritas plan to continue stamping or verifying.",
    });
  });

  it("maps rate_limited to a rate-limit toast using the error message when present", () => {
    const error = Object.assign(new Error("Slow down"), { errorCode: "rate_limited" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas rate limit",
      message: "Slow down",
    });
  });

  it("falls back to a default rate-limit message when the error has no message", () => {
    const error = Object.assign(new Error(""), { errorCode: "rate_limited" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas rate limit",
      message: "Integritas asked us to wait before retrying. Try again shortly.",
    });
  });

  it("maps upstream_unavailable to an unavailable toast using the error message when present", () => {
    const error = Object.assign(new Error("Timed out"), { errorCode: "upstream_unavailable" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas temporarily unavailable",
      message: "Timed out",
    });
  });

  it("falls back to a default unavailable message when the error has no message", () => {
    const error = Object.assign(new Error(""), { errorCode: "upstream_unavailable" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas temporarily unavailable",
      message: "The Integritas service could not be reached. Try again shortly.",
    });
  });

  it("falls back to a generic failure toast for an unknown errorCode using the Error message", () => {
    const error = Object.assign(new Error("Something broke"), { errorCode: "something_else" });
    expect(integritasErrorToast(error)).toEqual({
      title: "Integritas action failed",
      message: "Something broke",
    });
  });

  it("falls back to Unknown error when the value is not an Error instance", () => {
    expect(integritasErrorToast({ errorCode: "something_else" })).toEqual({
      title: "Integritas action failed",
      message: "Unknown error",
    });
  });
});
