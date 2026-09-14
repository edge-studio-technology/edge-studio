import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "../../../src/components/patterns/Page";

describe("Page", () => {
  it("renders title, description, action, and children", () => {
    render(
      <Page title="Settings" desc="Manage your settings" action={<button>Save</button>}>
        <p>Body</p>
      </Page>,
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Manage your settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("omits desc and action when not given", () => {
    render(
      <Page title="Settings">
        <p>Body</p>
      </Page>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
