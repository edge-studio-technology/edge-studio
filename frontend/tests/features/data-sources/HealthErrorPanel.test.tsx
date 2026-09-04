import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthErrorPanel } from "../../../src/features/data-sources/HealthErrorPanel";
import { formatLocalDateTime } from "../../../src/lib/time";
import type { DataSourceHealthStatus } from "../../../src/features/data-sources/dataSourceTypes";

describe("HealthErrorPanel", () => {
  it("shows the normalized error message from errorDetails", () => {
    const status: DataSourceHealthStatus = {
      ok: false,
      errorDetails: { message: "Connection refused" },
    };
    render(<HealthErrorPanel status={status} />);
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("falls back to the plain error string when there is no errorDetails", () => {
    const status: DataSourceHealthStatus = { ok: false, error: "Timed out" };
    render(<HealthErrorPanel status={status} />);
    expect(screen.getByText("Timed out")).toBeInTheDocument();
  });

  it("shows the checked-at row only when checkedAt is present", () => {
    const status: DataSourceHealthStatus = {
      ok: false,
      error: "Timed out",
      checkedAt: "2026-08-20T10:30:00.000Z",
    };
    render(<HealthErrorPanel status={status} />);
    expect(screen.getByText("Checked at")).toBeInTheDocument();
    expect(screen.getByText(formatLocalDateTime(status.checkedAt!))).toBeInTheDocument();
  });

  it("omits the checked-at row when checkedAt is missing", () => {
    render(<HealthErrorPanel status={{ ok: false, error: "Timed out" }} />);
    expect(screen.queryByText("Checked at")).not.toBeInTheDocument();
  });

  it("renders status.body as the raw JSON block when present", () => {
    render(<HealthErrorPanel status={{ ok: false, error: "e", body: { code: 500 } }} />);
    expect(screen.getByText(/"code": 500/)).toBeInTheDocument();
  });

  it("falls back to the whole status object as the raw JSON block when body is undefined", () => {
    render(<HealthErrorPanel status={{ ok: false, error: "e" }} />);
    expect(screen.getByText(/"ok": false/)).toBeInTheDocument();
  });
});
