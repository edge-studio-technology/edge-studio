import { Info } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPage } from "../../../src/components/patterns/StatusPage";

describe("StatusPage", () => {
  it("renders title, description, and action", () => {
    render(
      <StatusPage
        icon={Info}
        title="Not found"
        description="This page does not exist."
        action={<button>Go home</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByText("This page does not exist.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("omits optional description and action", () => {
    render(<StatusPage icon={Info} title="Coming soon" />);

    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeInTheDocument();
    expect(screen.queryByText("This page does not exist.")).not.toBeInTheDocument();
  });
});
