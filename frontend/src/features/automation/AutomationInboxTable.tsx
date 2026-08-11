import { Inbox, Mail, MailOpen } from "lucide-react";
import { useState } from "react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableIconMenu,
  TableRow,
  TableWrap,
} from "../../components/DataTable";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { LoadingState } from "../../components/patterns/LoadingState";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { JsonPreviewContent } from "../../components/JsonPreview";
import { Card } from "../../components/ui/Card";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import type { AutomationInboxItem } from "./automationTypes";
import { isImagePreviewContent, textPreviewContent } from "./workflow/workflowHelpers";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
] as const;

type InboxFilter = (typeof STATUS_FILTER_OPTIONS)[number]["value"];

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

function inboxMatchesFilter(item: AutomationInboxItem, query: string, filter: InboxFilter) {
  if (filter === "unread" && item.readAt) return false;
  if (filter === "read" && !item.readAt) return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.workflowName, item.format].join(" ").toLowerCase().includes(q);
}

/** Feature-wide Automation inbox (Show preview outputs). Not the workflow editor. */
export function AutomationInboxTable({
  items,
  busy,
  loading = false,
  onMarkRead,
  onDelete,
}: {
  items: AutomationInboxItem[];
  busy: boolean;
  loading?: boolean;
  onMarkRead: (item: AutomationInboxItem, read: boolean) => void;
  onDelete: (item: AutomationInboxItem) => void;
}) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const [detailsItem, setDetailsItem] = useState<AutomationInboxItem | null>(null);

  const unreadCount = items.filter((item) => !item.readAt).length;
  const filtersActive = Boolean(query.trim()) || filter !== "all";
  const filteredItems = items.filter((item) => inboxMatchesFilter(item, query, filter));
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setFilter("all");
    setQuery("");
    setPage(1);
  }

  function viewItem(item: AutomationInboxItem) {
    setDetailsItem(item);
    if (!item.readAt) onMarkRead(item, true);
  }

  return (
    <Card className="gap-detail-close grid w-full">
      <Disclosure
        title={
          <span className="gap-detail-close flex flex-wrap items-center">
            <h2 className="type-title text-text-primary m-0">Automation inbox</h2>
            <Pill tone={unreadCount > 0 ? "warn" : "neutral"} indicator>
              {unreadCount} unread
            </Pill>
          </span>
        }
        defaultOpen={false}
        contentClassName="gap-detail-close grid"
      >
        <p className="type-body text-text-secondary m-0">
          Local workflow previews stay here even if no browser was open when the workflow ran.
        </p>

        <div className="min-w-0 flex-1 [&>div]:mb-0">
          <ListFilterBar
            filter={filter}
            q={query}
            filterOptions={STATUS_FILTER_OPTIONS}
            searchPlaceholder="Title, workflow, or format"
            disabled={loading || items.length === 0}
            onFilterChange={(value) => {
              setFilter(value as InboxFilter);
              setPage(1);
            }}
            onQueryChange={(q) => {
              setQuery(q);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <LoadingState title="Fetching your inbox" description="This should take a few seconds." />
        ) : filteredItems.length === 0 ? (
          <EmptyContentState
            icon={Inbox}
            title={filtersActive ? "No matching previews" : "No preview items yet"}
            description={
              filtersActive
                ? "Try another status or search, or clear filters."
                : "Add a Show preview block to a workflow to see previews here."
            }
            actionLabel={filtersActive ? "Clear filters" : undefined}
            actionVariant="secondary"
            onAction={filtersActive ? clearFilters : undefined}
          />
        ) : (
          <TableWrap>
            <DataTable className="table-fixed">
              <TableHead>
                <TableHeaderCell className="w-64">Title</TableHeaderCell>
                <TableHeaderCell className="w-56">Workflow</TableHeaderCell>
                <TableHeaderCell className="w-28">Format</TableHeaderCell>
                <TableHeaderCell className="w-40">Created</TableHeaderCell>
                <TableHeaderCell className="w-28">Status</TableHeaderCell>
                <TableHeaderCell className="w-28 whitespace-nowrap">Actions</TableHeaderCell>
              </TableHead>
              <TableBody>
                {pagedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-0">
                      <strong className="block truncate" title={item.title}>
                        {item.title}
                      </strong>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="block truncate">{item.workflowName}</span>
                    </TableCell>
                    <TableCell>
                      <Pill>{item.format}</Pill>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <time className="type-meta text-text-secondary" dateTime={item.createdAt}>
                        {formatLocalDateTime(item.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      {item.readAt ? (
                        <Pill tone="neutral" indicator>
                          Read
                        </Pill>
                      ) : (
                        <Pill tone="warn" indicator>
                          Unread
                        </Pill>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <RowActions>
                        <TableIconButton
                          type="button"
                          title="View preview"
                          aria-label={`View preview for ${item.title}`}
                          onClick={() => viewItem(item)}
                        >
                          {item.readAt ? <MailOpen size={16} /> : <Mail size={16} />}
                        </TableIconButton>
                        <TableIconMenu
                          aria-label={`More actions for ${item.title}`}
                          items={[
                            {
                              label: item.readAt ? "Mark unread" : "Mark read",
                              disabled: busy,
                              onClick: () => onMarkRead(item, !item.readAt),
                            },
                            {
                              label: "Delete",
                              danger: true,
                              disabled: busy,
                              onClick: () => onDelete(item),
                            },
                          ]}
                        />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        )}

        <ListPaginationFooter
          page={currentPage}
          pageSize={pageSize}
          total={filteredItems.length}
          totalPages={totalPages}
          disabled={loading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </Disclosure>

      {detailsItem && <InboxDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />}
    </Card>
  );
}

/** "View preview" modal — key facts, then the format-specific preview in an expandable disclosure. */
function InboxDetailsModal({ item, onClose }: { item: AutomationInboxItem; onClose: () => void }) {
  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="gap-detail-near grid">
        <DetailList>
          <DetailRow label="Workflow" value={item.workflowName} />
          <DetailRow label="Format" value={<Pill>{item.format}</Pill>} />
          <DetailRow label="Created" value={formatLocalDateTime(item.createdAt)} />
        </DetailList>
        <Disclosure title="Preview">
          <InboxPreviewContent item={item} />
        </Disclosure>
      </div>
    </Modal>
  );
}

function InboxPreviewContent({ item }: { item: AutomationInboxItem }) {
  if (item.format === "json") return <JsonPreviewContent value={item.content} />;

  if (item.format === "link" && typeof item.content === "string") {
    return (
      <a
        className="type-link text-text-accent hover:text-text-accent-hover transition-colors duration-200"
        href={item.content}
        target="_blank"
        rel="noreferrer"
      >
        {item.content}
      </a>
    );
  }

  if (item.format === "image" && isImagePreviewContent(item.content)) {
    const src =
      item.content.source === "local_path"
        ? `/api/automation/inbox/${item.id}/image`
        : item.content.value;
    return (
      <div className="gap-detail-close grid">
        <img
          className="rounded-soft border-stroke-secondary max-h-[72vh] max-w-full border object-contain"
          src={src}
          alt={item.title}
        />
        <p className="type-meta text-text-secondary m-0">
          {item.content.source}: {item.content.value}
        </p>
      </div>
    );
  }

  return (
    <p className="type-body text-text-primary m-0 whitespace-pre-wrap">
      {textPreviewContent(item)}
    </p>
  );
}
