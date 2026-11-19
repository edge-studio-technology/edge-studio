// The publisher's side of funded data quests in the Marketplace module (#1380; the steps of UAT-Q03, Q04, Q05 and
// Q14 on the publisher's side). The marketplace API is mocked; the marketplace itself enforces every rule.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../src/components/ToastProvider";
import { PublisherQuests } from "../../../src/features/marketplace/PublisherQuests";

const api = vi.hoisted(() => ({
  getOpenQuests: vi.fn(),
  getMyQuestClaims: vi.fn(),
  getPublisherSources: vi.fn(),
  requestQuestSlot: vi.fn(),
  startQuestCollection: vi.fn(),
  disputeQuestSlot: vi.fn(),
  submitQuestDeliveryFile: vi.fn(),
}));
vi.mock("../../../src/features/marketplace/marketplaceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/features/marketplace/marketplaceApi")>()),
  ...api,
}));

const QUEST = {
  id: "Q1",
  status: "active",
  version: 1,
  title: "Soil moisture, five sites",
  criteria: "57 of 60 readings per device",
  schema: "{}",
  licence: "Single-organisation use",
  rewardCents: 20_000,
  deadline: "2026-12-16T12:00:00+02:00",
  budget: { capCents: 100_000, reservedCents: 20_000, availableCents: 80_000 },
  progress: { total: 5, unclaimed: 4, committed: 1, submitted: 0, accepted: 0, rejected: 0 },
  slots: [],
};
const SOURCES = [
  { id: "SRC-V", name: "Greenhouse sensors", attestations: 3, selectable: true },
  {
    id: "SRC-X",
    name: "Unverified sensor",
    attestations: 0,
    selectable: false,
    reason: "not verified",
  },
];
const CLAIMS = [
  {
    claimId: "C1",
    questId: "Q1",
    questTitle: "Soil moisture, five sites",
    questStatus: "active",
    questVersion: 1,
    deadline: QUEST.deadline,
    rewardCents: 20_000,
    sourceId: "SRC-V",
    status: "accepted",
    slot: 2,
    slotState: "committed",
    collectionStarted: false,
  },
  {
    claimId: "C2",
    questId: "Q9",
    questTitle: "Air quality",
    questStatus: "active",
    questVersion: 1,
    deadline: QUEST.deadline,
    rewardCents: 5_000,
    sourceId: "SRC-V",
    status: "requested",
    slot: null,
    slotState: null,
    collectionStarted: false,
  },
  {
    claimId: "C3",
    questId: "Q8",
    questTitle: "Energy use",
    questStatus: "active",
    questVersion: 1,
    deadline: QUEST.deadline,
    rewardCents: 5_000,
    sourceId: "SRC-V",
    status: "accepted",
    slot: 1,
    slotState: "accepted",
    collectionStarted: true,
  },
];

const renderQuests = (role: "owner" | "viewer" = "owner") =>
  render(
    <ToastProvider>
      <PublisherQuests role={role} />
    </ToastProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getOpenQuests.mockResolvedValue([QUEST]);
  api.getMyQuestClaims.mockResolvedValue(CLAIMS);
  api.getPublisherSources.mockResolvedValue(SOURCES);
});

describe("PublisherQuests", () => {
  it("shows open quests with their terms in UTC, and the publisher's own requests and slots", async () => {
    renderQuests();
    const open = await screen.findByRole("region", { name: "Open quests" });
    expect(within(open).getByText("Soil moisture, five sites")).toBeInTheDocument();
    expect(
      within(open).getByText(
        "4 of 5 slots open · $200.00 per slot · deadline 2026-12-16 10:00 UTC",
      ),
    ).toBeInTheDocument();
    const mine = screen.getByRole("region", { name: "My quest slots" });
    expect(within(mine).getByText("Slot 2: committed")).toBeInTheDocument();
    expect(within(mine).getByText("Waiting for the buyer's decision")).toBeInTheDocument();
  });

  it("asks for a slot with a verified source; a retry after a failure reuses the same request key", async () => {
    api.requestQuestSlot
      .mockRejectedValueOnce(
        Object.assign(new Error("Marketplace service unavailable"), { status: 503 }),
      )
      .mockResolvedValue({ claimId: "C9" });
    renderQuests();
    const open = await screen.findByRole("region", { name: "Open quests" });
    const source = within(open).getByLabelText("Source for Soil moisture, five sites");
    expect(within(source).queryByRole("option", { name: "Unverified sensor" })).toBeNull(); // only verified sources
    await userEvent.selectOptions(source, "SRC-V");
    await userEvent.click(within(open).getByRole("button", { name: "Ask for a slot" }));
    expect(await screen.findByText("Marketplace service unavailable")).toBeInTheDocument();
    await userEvent.click(within(open).getByRole("button", { name: "Ask for a slot" }));
    expect(api.requestQuestSlot).toHaveBeenCalledTimes(2);
    const [first, second] = api.requestQuestSlot.mock.calls;
    expect(first[0]).toBe("Q1");
    expect(first[1]).toBe("SRC-V");
    expect(second[2]).toBe(first[2]); // the same idempotency key: the marketplace treats it as the same request
  });

  it("says collection has started, and opens a dispute about an awarded slot", async () => {
    api.startQuestCollection.mockResolvedValue({ slot: 2, collectionStarted: true });
    api.disputeQuestSlot.mockResolvedValue({});
    renderQuests();
    const mine = await screen.findByRole("region", { name: "My quest slots" });
    await userEvent.click(within(mine).getByRole("button", { name: "Collection has started" }));
    expect(api.startQuestCollection).toHaveBeenCalledWith("Q1", 2);
    await userEvent.type(
      within(mine).getByLabelText("Reason for a dispute about Energy use, slot 1"),
      "The buyer rejected valid data.",
    );
    await userEvent.click(within(mine).getByRole("button", { name: "Open a dispute" }));
    expect(api.disputeQuestSlot).toHaveBeenCalledWith("Q8", 1, "The buyer rejected valid data.");
  });

  it("a viewer sees the quests but cannot act", async () => {
    renderQuests("viewer");
    await screen.findByRole("region", { name: "Open quests" });
    expect(screen.queryByRole("button", { name: "Ask for a slot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collection has started" })).toBeNull();
  });

  it("delivers a file for a slot: the node-signed counts, the full fingerprint and the delivery service entry are shown", async () => {
    const FP = "ab".repeat(32);
    api.submitQuestDeliveryFile.mockResolvedValue({
      submissionId: "SUB1",
      fingerprint: FP,
      counts: { "dev-a": 2, "dev-b": 1 },
      deliveryConfig: {
        "quest-SUB1": {
          path: "/data/marketplace-deliveries/quest-Q1-slot-2.ndjson",
          fingerprint: FP,
        },
      },
    });
    renderQuests();
    const mine = await screen.findByRole("region", { name: "My quest slots" });
    const file = new File(['{"device_id":"dev-a"}\n'], "readings.ndjson", {
      type: "application/x-ndjson",
    });
    await userEvent.upload(
      within(mine).getByLabelText("Delivery file for Soil moisture, five sites, slot 2"),
      file,
    );
    await userEvent.click(
      within(mine).getByRole("button", { name: "Sign and submit the delivery" }),
    );
    expect(api.submitQuestDeliveryFile).toHaveBeenCalledWith("Q1", 2, "SRC-V", file);
    expect(await within(mine).findByText(FP)).toBeInTheDocument();
    expect(within(mine).getByText("dev-a: 2 rows")).toBeInTheDocument();
    expect(within(mine).getByText(/"quest-SUB1"/)).toBeInTheDocument(); // the entry to add to the delivery service
  });

  it("shows a refused action as an error", async () => {
    api.startQuestCollection.mockRejectedValue(
      new Error("The marketplace refused the request (not_open)."),
    );
    renderQuests();
    const mine = await screen.findByRole("region", { name: "My quest slots" });
    await userEvent.click(within(mine).getByRole("button", { name: "Collection has started" }));
    expect(await within(mine).findByRole("alert")).toHaveTextContent(
      "The marketplace refused the request (not_open).",
    );
  });
});
