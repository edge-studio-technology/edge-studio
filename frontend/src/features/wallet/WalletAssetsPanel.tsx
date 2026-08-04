import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import {
  DataTable,
  RowActions,
  TableIconButton,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from "../../components/DataTable";
import { ListPagerFilterBar } from "../../components/ListPagerFilterBar";
import { TablePager } from "../../components/TablePager";
import { MutedText } from "../../components/Text";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatAmountAdaptive } from "../../lib/format";
import { AssetDetailModal } from "./AssetDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import type { TokenBalance } from "./walletTypes";

const ASSET_KIND_OPTIONS = [
  { value: "", label: "All" },
  { value: "minima", label: "Minima" },
  { value: "tokens", label: "Tokens" },
] as const;

export function WalletAssetsPanel({
  tokens,
  loading,
  actionsBlocked,
}: {
  tokens: TokenBalance[];
  loading: boolean;
  actionsBlocked: boolean;
}) {
  const [assetKind, setAssetKind] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetPage, setAssetPage] = useState(1);
  const [assetPageSize, setAssetPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [selectedAsset, setSelectedAsset] = useState<TokenBalance | null>(null);

  const trimmedAssetQuery = assetQuery.trim().toLowerCase();
  const visibleAssets = tokens.filter((t) => {
    if (assetKind === "minima" && !t.isNative) return false;
    if (assetKind === "tokens" && t.isNative) return false;
    if (!trimmedAssetQuery) return true;
    return (
      t.name.toLowerCase().includes(trimmedAssetQuery) ||
      t.tokenId.toLowerCase().includes(trimmedAssetQuery)
    );
  });
  const assetTotalPages = Math.max(1, Math.ceil(visibleAssets.length / assetPageSize));
  const assetCurrentPage = Math.min(assetPage, assetTotalPages);
  const pagedAssets = visibleAssets.slice(
    (assetCurrentPage - 1) * assetPageSize,
    assetCurrentPage * assetPageSize,
  );

  return (
    <>
      <p className="type-title mb-4">Assets</p>
      <ListPagerFilterBar
        page={assetCurrentPage}
        pageSize={assetPageSize}
        total={visibleAssets.length}
        totalPages={assetTotalPages}
        status={assetKind}
        q={assetQuery}
        statusOptions={ASSET_KIND_OPTIONS}
        statusLabel="Kind"
        searchPlaceholder="Name or coin ID"
        disabled={loading || actionsBlocked}
        onPageChange={setAssetPage}
        onPageSizeChange={(size) => {
          setAssetPageSize(size);
          setAssetPage(1);
        }}
        onStatusChange={(kind) => {
          setAssetKind(kind);
          setAssetPage(1);
        }}
        onQueryChange={(q) => {
          setAssetQuery(q);
          setAssetPage(1);
        }}
      />
      {loading || actionsBlocked ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-10 animate-spin text-slate-400" aria-hidden="true" />
        </div>
      ) : visibleAssets.length === 0 ? (
        <MutedText>
          {assetKind || trimmedAssetQuery ? "No matching assets." : "No assets found."}
        </MutedText>
      ) : (
        <TableWrap>
          <DataTable>
            <thead>
              <tr className={tableHeadRowClass}>
                <th className={`${tableHeaderCellClass} min-w-48`}>Name</th>
                <th className={tableHeaderCellClass}>Amount</th>
                <th className={`${tableHeaderCellClass} w-px whitespace-nowrap`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedAssets.map((token) => (
                <tr key={token.tokenId} className={tableRowClass}>
                  <td className={`${tableCellClass} min-w-48`}>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <TokenGlyph isNative={token.isNative} />
                      {token.name}
                    </span>
                  </td>
                  <td className={tableCellClass}>
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm text-slate-700 tabular-nums">
                      <TokenGlyph isNative={token.isNative} />
                      {formatAmountAdaptive(token.sendable)}
                    </span>
                  </td>
                  <td className={`${tableCellClass} w-px whitespace-nowrap`}>
                    <RowActions wrap={false}>
                      <TableIconButton
                        type="button"
                        title="View details"
                        aria-label={`View ${token.name}`}
                        onClick={() => setSelectedAsset(token)}
                      >
                        <Eye size={16} />
                      </TableIconButton>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      )}
      <div className="mt-3">
        <TablePager
          page={assetCurrentPage}
          pageSize={assetPageSize}
          total={visibleAssets.length}
          totalPages={assetTotalPages}
          disabled={loading || actionsBlocked}
          onPageChange={setAssetPage}
          onPageSizeChange={(size) => {
            setAssetPageSize(size);
            setAssetPage(1);
          }}
        />
      </div>
      {selectedAsset && (
        <AssetDetailModal token={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </>
  );
}
