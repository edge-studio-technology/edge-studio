import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ListDisclosure } from "../../../src/components/patterns/ListDisclosure";

describe("ListDisclosure", () => {
  it("renders the title with count and starts closed", () => {
    const { container } = render(
      <ListDisclosure title="Sources" count={3}>
        <p>Item content</p>
      </ListDisclosure>,
    );

    expect(screen.getByText("Sources (3)")).toBeInTheDocument();
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("renders count/max when max is given", () => {
    render(
      <ListDisclosure title="Sources" count={3} max={10}>
        <p>Item content</p>
      </ListDisclosure>,
    );
    expect(screen.getByText("Sources (3/10)")).toBeInTheDocument();
  });

  it("opens when the summary is clicked", async () => {
    const { container } = render(
      <ListDisclosure title="Sources" count={1}>
        <p>Item content</p>
      </ListDisclosure>,
    );

    await userEvent.click(screen.getByText("Sources (1)"));
    expect(container.querySelector("details")).toHaveAttribute("open");
  });
});
