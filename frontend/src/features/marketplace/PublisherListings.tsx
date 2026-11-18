import { useCallback, useEffect, useState } from "react";
import { Plus, Store } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Pill } from "../../components/ui/Pill";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import { useToast } from "../../components/ToastProvider";
import type { ApiError } from "../../lib/api";
import { describeLoadFailure } from "../../lib/errors";
import { ListingWizard } from "./ListingWizard";
import {
  canPublish,
  getPublisherListings,
  getPublisherSources,
  nextTransitions,
  priceText,
  PRODUCT_TYPES,
  transitionListing,
  type Listing,
  type MarketplaceRole,
  type PublisherSource,
} from "./marketplaceApi";

const ACTION_LABEL = { published: "Publish", paused: "Pause", unpublished: "Unpublish" } as const;

/** The seller's own listings on the marketplace, with the actions their marketplace role allows. */
export function PublisherListings({ role }: { role: MarketplaceRole }) {
  const { showToast } = useToast();
  const [data, setData] = useState<{ listings: Listing[]; sources: PublisherSource[] } | null>(null);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mayPublish = canPublish(role);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const [listings, sources] = await Promise.all([getPublisherListings(), getPublisherSources()]);
      setData({ listings, sources });
    } catch (failure) {
      // 503 is the backend's "marketplace unreachable"; anything else (e.g. a revoked key) is the marketplace's answer.
      setError(
        (failure as ApiError).status === 503
          ? { title: "Marketplace service unavailable", description: "Edge Studio could not reach the marketplace. Everything else in Edge Studio keeps working; try again in a moment." }
          : { title: "Could not load your listings", description: describeLoadFailure(failure) },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(listing: Listing, to: "published" | "paused" | "unpublished") {
    setBusyId(listing.id);
    try {
      await transitionListing(listing.id, to);
      await load();
    } catch (failure) {
      showToast({ tone: "error", title: `${ACTION_LABEL[to]} failed`, message: failure instanceof Error ? failure.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <ErrorContentState title={error.title} description={error.description} onRetry={() => void load()} />;
  }
  if (!data) return <LoadingState title="Loading your listings" />;

  const wizard = wizardOpen ? (
    <ListingWizard
      sources={data.sources}
      onClose={() => setWizardOpen(false)}
      onCreated={() => {
        setWizardOpen(false);
        showToast({ tone: "success", title: "Draft listing saved" });
        void load();
      }}
    />
  ) : null;

  if (data.listings.length === 0) {
    return (
      <>
        <EmptyContentState
          icon={Store}
          title="No listings yet"
          description={
            mayPublish
              ? "Create your first listing: choose one of your Integritas-verified devices, pick Dataset/File or Live Stream, describe the data and set a price. It is saved as a draft until you publish it."
              : "This installation has no listings yet. Your role can view listings but not create or publish them."
          }
          actionLabel={mayPublish ? "Create your first listing" : undefined}
          actionIcon={<Plus aria-hidden />}
          onAction={mayPublish ? () => setWizardOpen(true) : undefined}
        />
        {wizard}
      </>
    );
  }

  return (
    <div className="gap-detail-close flex w-full flex-col">
      {mayPublish ? (
        <Button className="self-end" iconStart={<Plus aria-hidden />} onClick={() => setWizardOpen(true)}>
          New listing
        </Button>
      ) : null}
      <ul className="gap-detail-next m-0 grid list-none p-0">
        {data.listings.map((listing) => (
          <li key={listing.id} className="border-stroke-secondary rounded-soft p-detail-close gap-detail-next flex flex-wrap items-center border">
            <div className="gap-detail-tight flex min-w-0 flex-1 flex-col">
              <span className="type-body-em text-text-primary">{listing.title || "Untitled draft"}</span>
              <span className="type-meta text-text-secondary">
                {PRODUCT_TYPES.find((type) => type.value === listing.type)?.label} · {listing.category ?? "No category"} · {priceText(listing)}
              </span>
            </div>
            <Pill tone={listing.state === "published" ? "good" : listing.state === "suspended" ? "error" : "neutral"}>{listing.state}</Pill>
            {mayPublish
              ? nextTransitions(listing.state).map((to) => (
                  <Button key={to} size="sm" variant="secondary" disabled={busyId === listing.id} onClick={() => void transition(listing, to)}>
                    {ACTION_LABEL[to]}
                  </Button>
                ))
              : null}
          </li>
        ))}
      </ul>
      {wizard}
    </div>
  );
}
