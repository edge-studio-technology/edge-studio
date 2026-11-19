import { useCallback, useEffect, useState } from "react";
import { Store } from "lucide-react";
import { Page } from "../components/patterns/Page";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { EmptyContentState } from "../components/patterns/EmptyContentState";
import { ErrorContentState } from "../components/patterns/ErrorContentState";
import { LoadingState } from "../components/patterns/LoadingState";
import { describeLoadFailure } from "../lib/errors";
import { MarketplaceCatalogue } from "../features/marketplace/MarketplaceCatalogue";
import { PublisherEarnings } from "../features/marketplace/PublisherEarnings";
import { PublisherListings } from "../features/marketplace/PublisherListings";
import { PublisherQuests } from "../features/marketplace/PublisherQuests";
import { getMarketplaceStatus, type MarketplaceStatus } from "../features/marketplace/marketplaceApi";

export function MarketplacePage() {
  const [status, setStatus] = useState<MarketplaceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"listings" | "earnings" | "quests" | "catalogue">("listings");

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await getMarketplaceStatus());
    } catch (failure) {
      setError(describeLoadFailure(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page
      title="Marketplace"
      desc={
        status?.configured
          ? `Marketplace configured: ${status.url}.`
          : "Sell your verified device data on the Data Marketplace and browse other listings."
      }
    >
      {error ? (
        <ErrorContentState title="Marketplace status unavailable" description={error} onRetry={() => void load()} />
      ) : !status ? (
        <LoadingState />
      ) : !status.configured || !status.url ? (
        <EmptyContentState
          icon={Store}
          title="Marketplace not configured"
          description="Set MARKETPLACE_URL and the installation key from the marketplace operator (MARKETPLACE_INSTALLATION_KEY) in this installation's .env, then restart Edge Studio."
        />
      ) : (
        <Card className="gap-detail-close flex w-full flex-col">
          <TabList
            label="Marketplace views"
            value={tab}
            options={[
              { value: "listings", label: "My listings" },
              { value: "earnings", label: "Earnings" }, // TC-FR12-19: the seller's sales and earnings
              { value: "quests", label: "Quests" }, // #1380: funded data quests, the publisher's side
              { value: "catalogue", label: "Catalogue" },
            ]}
            onChange={setTab}
          />
          {tab === "listings" ? (
            <PublisherListings role={status.role} />
          ) : tab === "earnings" ? (
            <PublisherEarnings />
          ) : tab === "quests" ? (
            <PublisherQuests role={status.role} />
          ) : (
            <MarketplaceCatalogue marketplaceUrl={status.url} />
          )}
        </Card>
      )}
    </Page>
  );
}
