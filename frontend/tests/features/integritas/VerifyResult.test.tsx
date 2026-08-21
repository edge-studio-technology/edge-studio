import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { extractVerifyMatch, VerifyResult } from "../../../src/features/integritas/VerifyResult";

function envelope(result: string, downloadUrl?: string) {
  return {
    data: {
      verification: { data: { result } },
      ...(downloadUrl ? { file: { download_url: downloadUrl } } : {}),
    },
  };
}

describe("extractVerifyMatch", () => {
  it("returns full_match for a 'Full match' result, case-insensitively", () => {
    expect(extractVerifyMatch(envelope("Full Match"))).toBe("full_match");
  });

  it("returns no_match for any other result string", () => {
    expect(extractVerifyMatch(envelope("no match"))).toBe("no_match");
  });

  it("reads the result from the first element when response is an array", () => {
    expect(extractVerifyMatch([envelope("full match")])).toBe("full_match");
  });

  it("returns no_match when the response is not an object", () => {
    expect(extractVerifyMatch(null)).toBe("no_match");
    expect(extractVerifyMatch("full match")).toBe("no_match");
    expect(extractVerifyMatch(undefined)).toBe("no_match");
  });

  it("returns no_match when result is missing or blank", () => {
    expect(extractVerifyMatch({ data: { verification: { data: {} } } })).toBe("no_match");
    expect(extractVerifyMatch(envelope("   "))).toBe("no_match");
  });
});

describe("VerifyResult", () => {
  it("renders a full match with no download link when no report url is present", () => {
    render(<VerifyResult response={envelope("full match")} onClose={vi.fn()} />);

    expect(screen.getByText("Full match")).toBeInTheDocument();
    expect(screen.getByText("The proof matches the original data.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download report" })).not.toBeInTheDocument();
  });

  it("renders a no-match result", () => {
    render(<VerifyResult response={envelope("no match")} onClose={vi.fn()} />);

    expect(screen.getByText("No match")).toBeInTheDocument();
    expect(screen.getByText("The proof does not match.")).toBeInTheDocument();
  });

  it("shows a download report link when a report url is present", () => {
    render(
      <VerifyResult
        response={envelope("full match", "https://example.com/report.pdf")}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Download report" })).toHaveAttribute(
      "href",
      "https://example.com/report.pdf",
    );
  });

  it("calls onClose when dismissed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<VerifyResult response={envelope("full match")} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Dismiss verify result" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
