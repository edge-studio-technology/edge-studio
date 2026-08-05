import { useEffect, useRef, useState } from "react";
import type { MinimaNodeState } from "../app/types";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { Page } from "../components/patterns/Page";
import { Card } from "../components/ui/Card";
import { TabList } from "../components/ui/TabList";
import { getWalletStatus, listWalletSendHistory } from "../features/wallet/walletApi";
import type { WalletSendHistoryItem, WalletStatus } from "../features/wallet/walletTypes";
import { AddressBookPanel } from "../features/address-book/AddressBookPanel";
// import { CreateTokenModal } from "../features/wallet/CreateTokenModal";
import { SendPaymentModal } from "../features/wallet/SendPaymentModal";
import { WalletAssetsPanel } from "../features/wallet/WalletAssetsPanel";
import { WalletHero } from "../features/wallet/WalletHero";
import { WalletHistoryPanel } from "../features/wallet/WalletHistoryPanel";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";

type WalletTab = "assets" | "address-book" | "history";

export function WalletPage() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  // const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [sendHistory, setSendHistory] = useState<WalletSendHistoryItem[]>([]);
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

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [status, history] = await Promise.all([getWalletStatus(), listWalletSendHistory(20)]);
      setWalletStatus(status);
      setSendHistory(history.sends);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
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
        totalMinima={totalMinima}
        disabled={actionsBlocked}
        onSend={() => setSendOpen(true)}
        // onCreateToken={() => setCreateTokenOpen(true)}
      />

      <Card className="gap-detail-close flex w-full flex-col">
        <TabList
          label="Wallet sections"
          value={mainTab}
          options={[
            { value: "history", label: "History" },
            { value: "assets", label: "Assets" },
            { value: "address-book", label: "Address book" },
          ]}
          onChange={setMainTab}
        />

        {mainTab === "assets" ? (
          <WalletAssetsPanel
            tokens={walletStatus?.tokens ?? []}
            loading={loading}
            actionsBlocked={actionsBlocked}
          />
        ) : mainTab === "address-book" ? (
          <AddressBookPanel actionsBlocked={actionsBlocked} />
        ) : (
          <WalletHistoryPanel
            items={sendHistory}
            loading={loading}
            error={error}
            actionsBlocked={actionsBlocked}
            onRefresh={refresh}
          />
        )}
      </Card>

      {sendOpen && (
        <SendPaymentModal
          walletStatus={walletStatus}
          actionsBlocked={actionsBlocked}
          minimaConfirmedUnavailable={minimaConfirmedUnavailable}
          onClose={() => setSendOpen(false)}
        />
      )}

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
