import { getJson, postForm, postJson } from "../../lib/api";

// The browser only talks to Edge Studio's backend; the backend holds the marketplace installation key.

export type MarketplaceRole = "owner" | "publisher" | "viewer";
export type MarketplaceStatus = { configured: boolean; url: string | null; role: MarketplaceRole };
export type PublisherSource = { id: string; name: string; attestations: number; selectable: boolean; reason?: string };
export type ListingType = "file" | "stream";
export type ListingState = "draft" | "published" | "paused" | "unpublished" | "suspended";
export type Listing = {
  id: string;
  type: ListingType;
  state: ListingState;
  title: string | null;
  category: string | null;
  price: { cents: number; currency: string } | null;
  verified: boolean;
};
export type CatalogueListing = Listing & {
  description: string | null;
  format: string | null;
  licence: string | null;
  availability: string | null;
  deliveryMethod: string | null;
};
export type LiveState = { delivery: "online" | "offline"; lastContactAt: string | null; data: "fresh" | "stale" | null; lastDataAt: string | null };

/** The only two product types (TC-FR03-06): no usage-based, pooled or auction types. */
export const PRODUCT_TYPES: { value: ListingType; label: string }[] = [
  { value: "file", label: "Dataset/File" },
  { value: "stream", label: "Live Stream" },
];
export const CATEGORIES = [
  "Environment and weather",
  "Energy consumption",
  "Equipment and machine telemetry",
  "Agriculture and growing conditions",
  "Other approved data streams (e.g. video)",
];
export const FORMATS = ["CSV", "JSON", "NDJSON", "Parquet"];
/** The marketplace's fixed licence list; "Custom" carries the seller's own text (up to 5,000 characters). */
export const LICENCES = [
  { value: "CC-BY-4.0", label: "Creative Commons Attribution 4.0 (CC BY 4.0)" },
  { value: "CC-BY-NC-4.0", label: "Creative Commons Attribution-NonCommercial 4.0 (CC BY-NC 4.0)" },
  { value: "Commercial-Single-Organisation", label: "Commercial licence, single organisation" },
  { value: "Custom", label: "My own licence" },
];
export const licenceLabel = (value: string | null) => LICENCES.find((l) => l.value === value)?.label ?? value ?? "";

/** Billing and delivery follow the type, so switching type can never leave a stale value (TC-FR03-03). */
const TYPE_FIELDS = {
  file: { billing: "one_off", deliveryMethod: "Seller-hosted download" },
  stream: { billing: "monthly", deliveryMethod: "Seller-hosted stream" },
} as const;

export type ListingDraft = {
  sourceId: string;
  type: ListingType;
  title: string;
  category: string;
  description: string;
  format: string;
  licence: string;
  licenceText: string;
  price: string;
  availability: string;
};

export function listingPayload(draft: ListingDraft) {
  return {
    sourceId: draft.sourceId,
    type: draft.type,
    ...TYPE_FIELDS[draft.type],
    title: draft.title.trim(),
    category: draft.category,
    description: draft.description,
    format: draft.format,
    licence: draft.licence,
    ...(draft.licence === "Custom" && { licenceText: draft.licenceText }),
    price: { amount: draft.price.trim(), currency: "USD" },
    availability: draft.availability.trim(),
  };
}

/** Owners and publishers may publish; viewers only read (TC-FR01-04). Edge Studio's admin is the owner. */
export function canPublish(role: MarketplaceRole) {
  return role === "owner" || role === "publisher";
}

/** What a seller can do next with a listing; mirrors the marketplace's seller lifecycle. */
export function nextTransitions(state: ListingState): ("published" | "paused" | "unpublished")[] {
  if (state === "draft") return ["published"];
  if (state === "published") return ["paused", "unpublished"];
  if (state === "paused") return ["published", "unpublished"];
  return [];
}

export function priceText(listing: Pick<Listing, "price" | "type">) {
  if (!listing.price) return "No price";
  if (listing.price.cents === 0) return "Free";
  const amount = `$${(listing.price.cents / 100).toFixed(2)}`;
  return listing.type === "stream" ? `${amount} per month` : amount;
}

export const getMarketplaceStatus = () => getJson<MarketplaceStatus>("/api/marketplace/status");
export const getPublisherSources = () => getJson<PublisherSource[]>("/api/marketplace/publisher/sources");
export const getPublisherListings = () => getJson<Listing[]>("/api/marketplace/publisher/listings");
export const createListing = (draft: ListingDraft) => postJson<Listing>("/api/marketplace/publisher/listings", listingPayload(draft));
/** acceptDeclaration: the version of the rights declaration the user accepted; the marketplace requires it to publish. */
export const transitionListing = (id: string, to: "published" | "paused" | "unpublished", acceptDeclaration?: number) =>
  postJson<Listing>(`/api/marketplace/publisher/listings/${encodeURIComponent(id)}/transitions`, { to, ...(acceptDeclaration !== undefined && { acceptDeclaration }) });

/** The marketplace's rights-to-sell declaration: its wording and version, accepted before each publish. */
export type RightsDeclaration = { version: number; text: string };
export const getRightsDeclaration = () => getJson<RightsDeclaration>("/api/marketplace/publisher/rights-declaration");

export function searchCatalogue(filter: { q: string; category: string; type: string }) {
  const query = new URLSearchParams(Object.entries(filter).filter(([, value]) => value)).toString();
  return getJson<CatalogueListing[]>(`/api/marketplace/catalogue${query ? `?${query}` : ""}`);
}
export const getCatalogueListing = (id: string) =>
  getJson<CatalogueListing & { live: LiveState }>(`/api/marketplace/catalogue/${encodeURIComponent(id)}`);

/** The seller's sales and earnings (TC-FR12-19): one entry per ledger row, in USD cents (refunds are negative). */
type EarningsEntry = {
  kind: "sale" | "renewal" | "refund";
  entitlementId: string;
  listingId: string;
  listingTitle: string | null;
  at: string;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  rateBps: number;
  payoutState: string | null;
  payoutTxpowid: string | null;
};
export type Earnings = {
  transactions: EarningsEntry[];
  totals: { grossCents: number; refundedCents: number; commissionCents: number; netCents: number };
  payoutCredit: string;
};
export const getEarnings = () => getJson<Earnings>("/api/marketplace/publisher/earnings");

/** USD cents as text, with the sign in front: -2125 is "-$21.25". */
export const centsText = (cents: number) => `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;

/** The marketplace's payout states in words (its settlement and payout states, rules §5). */
export function payoutStateText(state: string | null) {
  switch (state) {
    case "earned": return "Earned, waiting for payout";
    case "paused": return "Payout on hold";
    case "sending": return "Payout being sent";
    case "submitted": return "Payout sent, waiting for confirmations";
    case "confirmed": return "Paid (confirmed)";
    case "refunded": return "Refunded";
    default: return "Not yet earned"; // captured, or no settlement yet
  }
}

/** A funded data quest as anyone may see it (#1380): its terms and progress, naming neither buyer nor publishers. */
export type OpenQuest = {
  id: string;
  status: "draft" | "active" | "closed";
  version: number;
  title: string | null;
  criteria: string | null;
  schema: string | null;
  licence: string | null;
  rewardCents: number | null;
  deadline: string | null;
  progress: { total: number; unclaimed: number };
};
/** One of this installation's own requests for a quest slot, with the buyer's decision and where the slot stands. */
export type QuestClaim = {
  claimId: string;
  questId: string;
  questTitle: string | null;
  questStatus: string;
  questVersion: number;
  deadline: string | null;
  rewardCents: number | null;
  sourceId: string;
  status: "requested" | "accepted" | "declined";
  slot: number | null;
  slotState: string | null;
  collectionStarted: boolean;
};
export const getOpenQuests = () => getJson<OpenQuest[]>("/api/marketplace/quests");
export const getMyQuestClaims = () => getJson<QuestClaim[]>("/api/marketplace/quests/claims/mine");
/** idempotencyKey: one key per intended request, reused on a retry, so a slot is never asked for twice. */
export const requestQuestSlot = (questId: string, sourceId: string, idempotencyKey: string) =>
  postJson<{ claimId: string }>(`/api/marketplace/quests/${encodeURIComponent(questId)}/claims`, { sourceId, idempotencyKey });
export const startQuestCollection = (questId: string, slot: number) =>
  postJson<{ slot: number }>(`/api/marketplace/quests/${encodeURIComponent(questId)}/slots/${slot}/collection`, {});
export const disputeQuestSlot = (questId: string, slot: number, reason: string) =>
  postJson<unknown>(`/api/marketplace/quests/${encodeURIComponent(questId)}/slots/${slot}/disputes`, { reason });

/** An instant in UTC, the same for everyone: "2026-12-16 12:00 UTC" (a deadline may be stored with an offset). */
export function utcText(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "not set";
  const z = date.toISOString();
  return `${z.slice(0, 10)} ${z.slice(11, 16)} UTC`;
}

/** What Edge Studio built and submitted for a quest slot (backend questDelivery.service.ts). */
export type QuestDelivery = {
  submissionId: string;
  fingerprint: string;
  counts: Record<string, number>;
  /** The entry to add to the delivery service's DELIVERY_CONFIG "files", so the buyer can download it once accepted. */
  deliveryConfig: Record<string, { path: string; fingerprint: string }>;
};
/** Uploads the delivery file; the backend fingerprints it, counts it per device, has the node sign it and submits it. */
export function submitQuestDeliveryFile(questId: string, slot: number, sourceId: string, file: File) {
  const form = new FormData();
  form.append("sourceId", sourceId);
  form.append("file", file);
  return postForm<QuestDelivery>(`/api/marketplace/quests/${encodeURIComponent(questId)}/slots/${slot}/deliveries`, form);
}
