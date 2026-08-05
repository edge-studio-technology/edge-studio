import { useState } from "react";
import { Eye } from "lucide-react";
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
import { Button } from "../../components/ui/Button";
import { LoadingDots } from "../../components/ui/LoadingDots";
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
  const filtersActive = Boolean(assetKind || trimmedAssetQuery);
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

  function clearFilters() {
    setAssetKind("");
    setAssetQuery("");
    setAssetPage(1);
  }

  return (
    <div className="gap-detail-close flex flex-col">
      <div className="[&>div]:mb-0">
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
      </div>

      {loading || actionsBlocked ? (
        <div className="py-pad-relaxed flex justify-center" aria-busy="true">
          <LoadingDots />
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="gap-detail-next flex flex-col items-start">
          <p className="type-body text-text-secondary m-0">
            {filtersActive
              ? "No assets match this kind or search."
              : "No assets in this wallet yet."}
          </p>
          {/* {filtersActive ? (
            <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null} */}
        </div>
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
                    <span className="gap-detail-next type-body-em text-text-primary inline-flex items-center">
                      <TokenGlyph isNative={token.isNative} />
                      {token.name}
                    </span>
                  </td>
                  <td className={tableCellClass}>
                    <span className="type-mono text-text-secondary tabular-nums">
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

      {selectedAsset && (
        <AssetDetailModal token={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
