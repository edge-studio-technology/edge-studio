import { useState } from "react";
import { Coins, Eye, Inbox } from "lucide-react";
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
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { LoadingState } from "../../components/patterns/LoadingState";
import {
  orderedColumns,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatMinimaAmount } from "../../lib/format";
import { AssetDetailModal } from "./AssetDetailModal";
import { TokenGlyph } from "./TokenGlyph";
import type { TokenBalance } from "./walletTypes";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";

const ASSET_KIND_OPTIONS = [
  { value: "", label: "All" },
  { value: "minima", label: "Minima" },
  { value: "tokens", label: "Tokens" },
] as const;

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const WALLET_ASSET_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "amount", label: "Amount" },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

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
  const { visibility, columnOrder, setVisibility, setColumnOrder } = useTableColumnVisibility(
    "wallet-assets",
    WALLET_ASSET_COLUMNS,
  );
  const visibleColumns = orderedColumns(WALLET_ASSET_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );

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
      <TableControls
        utilities={
          <TableColumnVisibilityButton
            tableLabel="Wallet assets"
            columns={WALLET_ASSET_COLUMNS}
            visibility={visibility}
            columnOrder={columnOrder}
            onChange={setVisibility}
            onOrderChange={setColumnOrder}
          />
        }
      >
        <div className="[&>div]:mb-0">
          <ListFilterBar
            filter={assetKind}
            q={assetQuery}
            filterOptions={ASSET_KIND_OPTIONS}
            searchPlaceholder="Name or coin ID"
            disabled={pagerDisabled || tokens.length === 0}
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
      </TableControls>

      {loading || actionsBlocked ? (
        <LoadingState title="Fetching your assets" description="This should take a few seconds." />
      ) : visibleAssets.length === 0 ? (
        <EmptyContentState
          icon={filtersActive ? Inbox : Coins}
          title={filtersActive ? "No matching assets" : "No assets yet"}
          description={
            filtersActive
              ? "Try another kind or search, or clear filters."
              : "Assets held by this wallet will be added to your library here."
          }
          actionLabel={filtersActive ? "Clear filters" : undefined}
          actionVariant="secondary"
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <TableWrap>
          <DataTable>
            <TableHead>
              {visibleColumns.map((column) => (
                <TableHeaderCell
                  key={column.id}
                  sticky={column.id === "actions"}
                  className={column.id === "actions" ? "w-px whitespace-nowrap" : undefined}
                >
                  {column.label}
                </TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {pagedAssets.map((token) => (
                <TableRow key={token.tokenId}>
                  {visibleColumns.map((column) => (
                    <WalletAssetCell
                      key={column.id}
                      columnId={column.id}
                      token={token}
                      onView={() => setSelectedAsset(token)}
                    />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

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

function WalletAssetCell({
  columnId,
  token,
  onView,
}: {
  columnId: string;
  token: TokenBalance;
  onView: () => void;
}) {
  if (columnId === "name") {
    return (
      <TableCell className="min-w-0">
        <span className="gap-detail-next inline-flex max-w-full min-w-0 items-center">
          <TokenGlyph isNative={token.isNative} />
          <span className="truncate">{token.name}</span>
        </span>
      </TableCell>
    );
  }
  if (columnId === "amount") {
    return (
      <TableCell>
        <span className="type-mono tabular-nums">{formatMinimaAmount(token.sendable, 12)}</span>
      </TableCell>
    );
  }
  if (columnId === "actions") {
    return (
      <TableCell sticky className="w-px whitespace-nowrap">
        <RowActions>
          <TableIconButton type="button" title="View details" aria-label={`View ${token.name}`} onClick={onView}>
            <Eye size={16} />
          </TableIconButton>
        </RowActions>
      </TableCell>
    );
  }
  return null;
}
