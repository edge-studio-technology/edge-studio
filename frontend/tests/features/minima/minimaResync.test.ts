import { describe, expect, it } from "vitest";
import { resyncPhaseLabel, resyncPhaseTone } from "../../../src/features/minima/minimaResync";

describe("resync presentation", () => {
  it("keeps a recovered uncertain outcome separate from completion", () => {
    expect(resyncPhaseLabel.unconfirmed).toBe("Resync outcome unconfirmed");
    expect(resyncPhaseTone("unconfirmed")).toBe("warn");
    expect(resyncPhaseTone("completed")).toBe("good");
    expect(resyncPhaseTone("failed")).toBe("error");
  });
});
