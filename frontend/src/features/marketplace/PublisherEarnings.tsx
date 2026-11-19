// The seller's sales and earnings in the Marketplace module (TC-FR12-19, Edge Studio Data Marketplace V1).
// Shown on the Marketplace page's "Earnings" tab. One row per entry of the marketplace's ledger (a sale, a stream
// renewal or a refund), read through Edge Studio's backend (GET /api/marketplace/publisher/earnings), with the
// payout state of the sale or period it belongs to. The figures are shown exactly as the ledger has them; nothing
// is recomputed here, so the screen cannot disagree with the books.
import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrap,
} from "../../components/DataTable";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import type { ApiError } from "../../lib/api";
import { describeLoadFailure } from "../../lib/errors";
import { centsText, getEarnings, payoutStateText, type Earnings } from "./marketplaceApi";

const KIND_LABEL: Record<string, string> = { sale: "Sale", renewal: "Renewal", refund: "Refund" };

export function PublisherEarnings() {
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      setData(await getEarnings());
    } catch (failure) {
      // As on the listings tab: 503 is the backend's "marketplace unreachable".
      setError(
        (failure as ApiError).status === 503
          ? {
              title: "Marketplace service unavailable",
              description:
                "Edge Studio could not reach the marketplace. Everything else in Edge Studio keeps working; try again in a moment.",
            }
          : { title: "Could not load your earnings", description: describeLoadFailure(failure) },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <ErrorContentState
        title={error.title}
        description={error.description}
        onRetry={() => void load()}
      />
    );
  if (!data) return <LoadingState />;
  if (data.transactions.length === 0)
    return (
      <EmptyContentState
        icon={Wallet}
        title="No sales yet"
        description="Sales, renewals and refunds of your listings appear here with what you earn from each."
      />
    );

  const totals = [
    { label: "Gross sales", value: centsText(data.totals.grossCents) },
    { label: "Refunded", value: centsText(data.totals.refundedCents) },
    { label: "Commission", value: centsText(data.totals.commissionCents) },
    { label: "Net earnings", value: centsText(data.totals.netCents) },
  ];
  return (
    <div className="gap-detail-close flex flex-col">
      <dl className="gap-detail-close m-0 grid grid-cols-2 sm:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label}>
            <dt className="type-body text-text-secondary">{t.label}</dt>
            <dd className="type-body-em text-text-primary m-0">{t.value}</dd>
          </div>
        ))}
      </dl>
      {/* TC-SET-04: the token remainder kept back by rounding a payout down is added to the next payout. */}
      <p className="type-body text-text-secondary m-0">
        Added to your next payout: {data.payoutCredit} tokens.
      </p>
      <TableWrap>
        <DataTable aria-label="Sales and earnings">
          <TableHead>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Listing</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Gross</TableHeaderCell>
            <TableHeaderCell>Commission</TableHeaderCell>
            <TableHeaderCell>Net</TableHeaderCell>
            <TableHeaderCell>Payout</TableHeaderCell>
          </TableHead>
          <TableBody>
            {data.transactions.map((t, i) => (
              <TableRow key={`${t.entitlementId}-${i}`}>
                <TableCell>{new Date(t.at).toLocaleDateString()}</TableCell>
                <TableCell>{t.listingTitle ?? "Untitled listing"}</TableCell>
                <TableCell>{KIND_LABEL[t.kind] ?? t.kind}</TableCell>
                <TableCell>{centsText(t.grossCents)}</TableCell>
                <TableCell>{centsText(t.commissionCents)}</TableCell>
                <TableCell>{centsText(t.netCents)}</TableCell>
                <TableCell className="whitespace-normal">
                  {payoutStateText(t.payoutState)}
                  {/* The Minima transaction id in full (never shortened), so it can be looked up on chain. */}
                  {t.payoutTxpowid && (
                    <span className="type-body text-text-secondary block font-mono break-all">
                      {t.payoutTxpowid}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrap>
    </div>
  );
}
