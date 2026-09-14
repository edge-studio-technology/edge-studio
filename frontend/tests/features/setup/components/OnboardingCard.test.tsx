import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingCard } from "../../../../src/features/setup/components/OnboardingCard";

describe("OnboardingCard", () => {
  it("renders its children", () => {
    render(
      <OnboardingCard>
        <p>Card content</p>
      </OnboardingCard>,
    );

    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("merges a custom className onto the card", () => {
    render(
      <OnboardingCard className="custom-class">
        <p>Card content</p>
      </OnboardingCard>,
    );

    expect(screen.getByText("Card content").closest("section")).toHaveClass("custom-class");
  });
});
