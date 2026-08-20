import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JsonPreview, JsonPreviewContent } from "../../../src/components/patterns/JsonPreview";

describe("JsonPreview", () => {
  it("renders a link-style trigger by default and opens a modal on click", async () => {
    render(<JsonPreview value={{ a: 1 }} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "View JSON" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });

  it("renders a button-style trigger with a custom label", () => {
    render(<JsonPreview value={{}} variant="button" label="Show data" />);
    expect(screen.getByRole("button", { name: "Show data" })).toBeInTheDocument();
  });

  it("disables the trigger when disabled is set", () => {
    render(<JsonPreview value={{}} disabled />);
    expect(screen.getByRole("button", { name: "View JSON" })).toBeDisabled();
  });
});

describe("JsonPreviewContent", () => {
  it("renders formatted JSON", () => {
    render(<JsonPreviewContent value={{ hello: "world" }} />);
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
  });
});
