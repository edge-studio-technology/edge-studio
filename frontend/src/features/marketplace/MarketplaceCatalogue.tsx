import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Button, LinkButton } from "../../components/ui/Button";
import { InputField } from "../../components/ui/InputField";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { SelectField } from "../../components/ui/SelectField";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import {
  CATEGORIES,
  getCatalogueListing,
  licenceLabel,
  priceText,
  PRODUCT_TYPES,
  searchCatalogue,
  type CatalogueListing,
  type LiveState,
} from "./marketplaceApi";

const OFFLINE_TITLE = "Marketplace unavailable";
const OFFLINE_DESCRIPTION =
  "Edge Studio cannot reach the marketplace. Check this device's internet connection. Listings and seller status are hidden until the marketplace answers again, so nothing out of date is shown as live.";

/** Purchases happen on the marketplace website, with the same checkout and entitlements as any buyer (TC-FR07-05). */
function buyUrl(marketplaceUrl: string, id: string) {
  return `${marketplaceUrl}/listing/${encodeURIComponent(id)}`;
}

function liveText(live: LiveState) {
  const contact = live.lastContactAt ? `last contact ${new Date(live.lastContactAt).toLocaleString()}` : "never seen online";
  const seller = `Seller ${live.delivery} (${contact})`;
  if (!live.data) return seller;
  return `${seller} · data ${live.data === "fresh" ? "up to date" : "stale"}`;
}

function BuyLink({ marketplaceUrl, listing }: { marketplaceUrl: string; listing: CatalogueListing }) {
  return (
    <LinkButton href={buyUrl(marketplaceUrl, listing.id)} target="_blank" rel="noopener noreferrer" size="sm" iconEnd={<ExternalLink aria-hidden />}>
      Buy on marketplace
    </LinkButton>
  );
}

/** One listing fetched fresh, including the seller's live delivery state; on failure nothing is shown as live. */
function ListingDetails({ id, marketplaceUrl, onClose }: { id: string; marketplaceUrl: string; onClose: () => void }) {
  const [state, setState] = useState<{ listing?: CatalogueListing & { live: LiveState }; failed?: boolean }>({});

  useEffect(() => {
    getCatalogueListing(id).then(
      (listing) => setState({ listing }),
      () => setState({ failed: true }),
    );
  }, [id]);

  const { listing } = state;
  return (
    <Modal title={listing?.title ?? "Listing"} onClose={onClose} footer={listing ? <BuyLink marketplaceUrl={marketplaceUrl} listing={listing} /> : null}>
      {state.failed ? (
        <ErrorContentState title={OFFLINE_TITLE} description={OFFLINE_DESCRIPTION} />
      ) : !listing ? (
        <LoadingState />
      ) : (
        <div className="gap-detail-close grid">
          <p className="type-meta text-text-secondary m-0">{liveText(listing.live)}</p>
          <p className="type-body text-text-primary m-0 whitespace-pre-wrap">{listing.description}</p>
          <dl className="gap-detail-tight type-meta m-0 grid grid-cols-[auto_1fr] gap-x-4">
            <dt className="text-text-secondary">Format</dt>
            <dd className="m-0">{listing.format}</dd>
            <dt className="text-text-secondary">Licence</dt>
            <dd className="m-0">{licenceLabel(listing.licence)}</dd>
            <dt className="text-text-secondary">Availability</dt>
            <dd className="m-0">{listing.availability}</dd>
            <dt className="text-text-secondary">Delivery</dt>
            <dd className="m-0">{listing.deliveryMethod}</dd>
          </dl>
        </div>
      )}
    </Modal>
  );
}

/** Browse and search the public marketplace catalogue from inside Edge Studio. */
export function MarketplaceCatalogue({ marketplaceUrl }: { marketplaceUrl: string }) {
  const [filter, setFilter] = useState({ q: "", category: "", type: "" });
  const [items, setItems] = useState<CatalogueListing[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (current: typeof filter) => {
    // Clear first: results from an earlier answer must never stay on screen once the marketplace stops answering.
    setItems(null);
    setOffline(false);
    try {
      setItems(await searchCatalogue(current));
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load({ q: "", category: "", type: "" });
  }, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(filter);
  }

  return (
    <div className="gap-detail-close flex w-full flex-col">
      <form className="gap-detail-next grid items-end sm:grid-cols-[2fr_1fr_1fr_auto]" onSubmit={submit} role="search">
        <InputField label="Search" value={filter.q} onChange={(event) => setFilter({ ...filter, q: event.target.value })} />
        <SelectField
          label="Category"
          value={filter.category}
          options={[{ value: "", label: "All categories" }, ...CATEGORIES.map((category) => ({ value: category, label: category }))]}
          onChange={(event) => setFilter({ ...filter, category: event.target.value })}
        />
        <SelectField
          label="Type"
          value={filter.type}
          options={[{ value: "", label: "All types" }, ...PRODUCT_TYPES]}
          onChange={(event) => setFilter({ ...filter, type: event.target.value })}
        />
        <Button type="submit" iconStart={<Search aria-hidden />}>
          Search
        </Button>
      </form>

      {offline ? (
        <ErrorContentState title={OFFLINE_TITLE} description={OFFLINE_DESCRIPTION} onRetry={() => void load(filter)} />
      ) : !items ? (
        <LoadingState title="Loading the catalogue" />
      ) : items.length === 0 ? (
        <EmptyContentState icon={Search} title="No listings found" description="Try other words or remove a filter." />
      ) : (
        <ul className="gap-detail-next m-0 grid list-none p-0">
          {items.map((listing) => (
            <li key={listing.id} className="border-stroke-secondary rounded-soft p-detail-close gap-detail-next flex flex-wrap items-center border">
              <div className="gap-detail-tight flex min-w-0 flex-1 flex-col">
                <span className="type-body-em text-text-primary">{listing.title}</span>
                <span className="type-meta text-text-secondary">
                  {PRODUCT_TYPES.find((type) => type.value === listing.type)?.label} · {listing.category} · {priceText(listing)}
                </span>
              </div>
              {listing.verified ? <Pill tone="good">Integritas verified</Pill> : null}
              <Button size="sm" variant="secondary" onClick={() => setOpenId(listing.id)}>
                Details
              </Button>
              <BuyLink marketplaceUrl={marketplaceUrl} listing={listing} />
            </li>
          ))}
        </ul>
      )}
      {openId ? <ListingDetails id={openId} marketplaceUrl={marketplaceUrl} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
