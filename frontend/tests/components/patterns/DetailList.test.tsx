import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DetailList, DetailRow } from "../../../src/components/patterns/DetailList";

describe("DetailList", () => {
  it("renders DetailRow label/value pairs", () => {
    render(
      <DetailList>
        <DetailRow label="Status" value="Active" />
        <DetailRow label="Hash" value="abc123" mono />
      </DetailList>,
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Hash")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toHaveClass("font-mono");
  });
});
