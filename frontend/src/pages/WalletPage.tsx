import { useCallback, useEffect, useRef, useState } from "react";
import type { MinimaNodeState } from "../app/types";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { Page } from "../components/patterns/Page";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { getWalletStatus, listWalletHistory } from "../features/wallet/walletApi";
import {
  DEFAULT_WALLET_HISTORY_FILTERS,
  emptyWalletHistoryPage,
  isCustomRangeInvalid,
  walletHistoryQuery,
  type WalletHistoryFilters,
} from "../features/wallet/walletHistory";
import type { WalletHistoryPage, WalletStatus } from "../features/wallet/walletTypes";
import { AddressBookPanel } from "../features/address-book/AddressBookPanel";
import { AssetDetailModal } from "../features/wallet/AssetDetailModal";
// import { CreateTokenModal } from "../features/wallet/CreateTokenModal";
import { SendPaymentModal } from "../features/wallet/SendPaymentModal";
import { ReceiveAddressModal } from "../features/wallet/ReceiveAddressModal";
// import { WalletAssetsPanel } from "../features/wallet/WalletAssetsPanel";
import { WalletHero } from "../features/wallet/WalletHero";
import { WalletHistoryPanel } from "../features/wallet/WalletHistoryPanel";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";
import { applyPaginatedPage } from "../lib/paginated";

type WalletTab = "assets" | "address-book" | "history";

export function WalletPage() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<WalletHistoryFilters>(DEFAULT_WALLET_HISTORY_FILTERS);
  const [history, setHistory] = useState<WalletHistoryPage>(emptyWalletHistoryPage);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequestRef = useRef(0);
  const [mainTab, setMainTab] = useState<WalletTab>("history");
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  const previousMinimaStateRef = useRef<MinimaNodeState | null>(null);

  useMinimaStatusRefresh(
    (status) => {
      const previous = previousMinimaStateRef.current;
      previousMinimaStateRef.current = status.state;
      setMinimaState(status.state);
      // Wallet data was fetched once on mount and goes stale/wrong the moment the
      // node drops out from under it (restart/resync) — reload it once the node
      // is confirmed running again instead of leaving the page stuck on whatever
      // it last managed to load until the user navigates away and back.
      if (previous !== null && previous !== "running" && status.state === "running") {
        refresh();
      } else if (previous !== null) {
        // Picks up incoming payments and confirmations without a loading flash.
        void loadStatus({ quiet: true });
        void loadHistory(historyFilters, { quiet: true });
      }
    },
    () => {},
  );
  // Only allow wallet actions once Minima is confirmed running — any other state
  // (loading, stopped, error, restarting) means an RPC call would just fail. Buttons
  // stay disabled during the initial "haven't checked yet" window too, but the warning
  // banner itself only appears once we've actually confirmed the node isn't running —
  // otherwise it flashes "unavailable" for a node that's actually fine.
  const actionsBlocked = minimaState !== "running";
  const minimaConfirmedUnavailable = minimaState !== null && minimaState !== "running";

  function refresh() {
    void loadStatus();
    void loadHistory(historyFilters);
  }

  async function loadStatus({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      setWalletStatus(await getWalletStatus());
      setError(null);
    } catch (err) {
      if (!quiet) setError(err instanceof Error ? err.message : "Failed to load wallet.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  const loadHistory = useCallback(
    async (filters: WalletHistoryFilters, { quiet = false }: { quiet?: boolean } = {}) => {
      if (isCustomRangeInvalid(filters)) return;
      const request = ++historyRequestRef.current;
      if (!quiet) {
        setHistoryLoading(true);
        setHistoryError(null);
      }
      try {
        const response = await listWalletHistory(walletHistoryQuery(filters));
        if (request !== historyRequestRef.current) return;
        applyPaginatedPage(response, filters.page, setHistory, (page) =>
          setHistoryFilters((current) => ({ ...current, page })),
        );
        setHistoryError(null);
      } catch (err) {
        if (request !== historyRequestRef.current || quiet) return;
        setHistoryError(err instanceof Error ? err.message : "Failed to load wallet history.");
      } finally {
        if (request === historyRequestRef.current) setHistoryLoading(false);
      }
    },
    [],
  );

  function updateHistoryFilters(patch: Partial<WalletHistoryFilters>) {
    setHistoryFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  useEffect(() => {
    void loadHistory(historyFilters);
  }, [historyFilters, loadHistory]);

  useEffect(() => {
    void loadStatus();
  }, []);

  const nativeToken = walletStatus?.tokens.find((t) => t.isNative);
  const totalMinima = nativeToken?.sendable ?? "0";

  return (
    <Page title="Wallet" desc="Manage your Minima wallet and transactions.">
      {minimaConfirmedUnavailable ? (
        <ErrorAlert status="warning" title="Minima isn't running" className="w-full max-w-none">
          Wallet actions are unavailable. Try restarting the Minima container.
        </ErrorAlert>
      ) : null}

      <WalletHero
        loading={loading}
        unavailable={Boolean(error)}
        totalMinima={totalMinima}
        disabled={actionsBlocked}
        onSend={() => setSendOpen(true)}
        onReceive={() => setReceiveOpen(true)}
        onInfo={() => setInfoOpen(true)}
        // onCreateToken={() => setCreateTokenOpen(true)}
      />

      <Card className="gap-detail-close flex w-full flex-col">
        <TabList
          label="Wallet sections"
          value={mainTab}
          options={[
            { value: "history", label: "History" },
            // { value: "assets", label: "Assets" },
            { value: "address-book", label: "Address book" },
          ]}
          onChange={setMainTab}
        />

        {/* Assets tab disabled for v1 — a single native token makes a separate assets list redundant.
        {mainTab === "assets" ? (
          <WalletAssetsPanel
            tokens={walletStatus?.tokens ?? []}
            loading={loading}
            actionsBlocked={actionsBlocked}
          />
        ) : */}
        {mainTab === "address-book" ? (
          <AddressBookPanel actionsBlocked={actionsBlocked} />
        ) : (
          <WalletHistoryPanel
            history={history}
            filters={historyFilters}
            loading={historyLoading}
            error={historyError}
            actionsBlocked={actionsBlocked}
            onFiltersChange={updateHistoryFilters}
            onRefresh={() => loadHistory(historyFilters)}
          />
        )}
      </Card>

      {sendOpen && (
        <SendPaymentModal
          walletStatus={walletStatus}
          actionsBlocked={actionsBlocked}
          minimaConfirmedUnavailable={minimaConfirmedUnavailable}
          onClose={() => {
            setSendOpen(false);
            void loadStatus({ quiet: true });
            void loadHistory(historyFilters, { quiet: true });
          }}
        />
      )}

      {receiveOpen ? (
        <ReceiveAddressModal
          actionsBlocked={actionsBlocked}
          onClose={() => setReceiveOpen(false)}
        />
      ) : null}

      {infoOpen && nativeToken ? (
        <AssetDetailModal token={nativeToken} onClose={() => setInfoOpen(false)} />
      ) : null}

      {/* {createTokenOpen && (
        <CreateTokenModal
          walletStatus={walletStatus}
          actionsBlocked={actionsBlocked}
          minimaConfirmedUnavailable={minimaConfirmedUnavailable}
          onClose={() => setCreateTokenOpen(false)}
          onCreated={refresh}
        />
      )} */}
    </Page>
  );
}
