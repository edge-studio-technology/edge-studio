import { useState } from "react";
import { Eye } from "lucide-react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableRow,
  TableWrap,
} from "../../components/DataTable";
import { Button } from "../../components/ui/Button";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatMinimaAmount } from "../../lib/format";
import { AssetDetailModal } from "./AssetDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import type { TokenBalance } from "./walletTypes";

const ASSET_KIND_OPTIONS = [
  { value: "", label: "All" },
  { value: "minima", label: "Minima" },
  { value: "tokens", label: "Tokens" },
] as const;

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

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
  const pagerDisabled = loading || actionsBlocked;
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
        <ListFilterBar
          filter={assetKind}
          q={assetQuery}
          filterOptions={ASSET_KIND_OPTIONS}
          filterLabel="Kind"
          searchPlaceholder="Name or coin ID"
          disabled={pagerDisabled}
          onFilterChange={(kind) => {
            setAssetKind(kind);
            setAssetPage(1);
          }}
          onQueryChange={(q) => {
            setAssetQuery(q);
            setAssetPage(1);
          }}
        />
      </div>

      <TableWrap>
        <DataTable>
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
          </TableHead>
          <TableBody>
            {loading || actionsBlocked ? (
              <TableRow>
                <TableCell colSpan={3} className="p-0">
                  <div className="py-pad-relaxed flex items-center justify-center" aria-busy="true">
                    <LoadingDots />
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleAssets.length === 0 ? (
              <TableRow>
                <td colSpan={3} className="p-0">
                  <div className="gap-detail-close p-margin-tight py-pad-relaxed flex flex-col items-start">
                    <p className="type-body text-text-secondary m-0">
                      {filtersActive
                        ? "No assets match this kind or search."
                        : "No assets in this wallet yet."}
                    </p>
                    {filtersActive ? (
                      <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                </td>
              </TableRow>
            ) : (
              pagedAssets.map((token) => (
                <TableRow key={token.tokenId}>
                  <TableCell className="min-w-0">
                    <span className="gap-detail-next inline-flex max-w-full min-w-0 items-center">
                      <TokenGlyph isNative={token.isNative} />
                      <span className="truncate">{token.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="type-mono tabular-nums">
                      {formatMinimaAmount(token.sendable, 12)}
                    </span>
                  </TableCell>
                  <TableCell className="w-px whitespace-nowrap">
                    <RowActions>
                      <TableIconButton
                        type="button"
                        title="View details"
                        aria-label={`View ${token.name}`}
                        onClick={() => setSelectedAsset(token)}
                      >
                        <Eye size={16} />
                      </TableIconButton>
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </DataTable>
      </TableWrap>

      <ListPaginationFooter
        page={assetCurrentPage}
        pageSize={assetPageSize}
        total={visibleAssets.length}
        totalPages={assetTotalPages}
        disabled={pagerDisabled}
        onPageChange={setAssetPage}
        onPageSizeChange={(size) => {
          setAssetPageSize(size);
          setAssetPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {selectedAsset && (
        <AssetDetailModal token={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
