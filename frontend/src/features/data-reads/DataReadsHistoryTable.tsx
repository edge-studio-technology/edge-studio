import {
  DataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrap,
} from "../../components/patterns/DataTable";
import { ErrorDetails } from "../../components/patterns/ErrorDetails";
import { JsonPreview } from "../../components/patterns/JsonPreview";
import { Text } from "../../components/ui/Text";
import { Pill } from "../../components/ui/Pill";
import { DEFAULT_PAGE_SIZE } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import type { DataSourceRead } from "./dataReadTypes";

function proofHistoryLink(proofId: string) {
  const params = new URLSearchParams({
    tab: "proofs",
    page: "1",
    pageSize: String(DEFAULT_PAGE_SIZE),
    q: proofId,
  });
  return `/diagnostics?${params.toString()}`;
}

export function DataReadsHistoryTable({
  items,
  filtered,
}: {
  items: DataSourceRead[];
  filtered?: boolean;
}) {
  return (
    <TableWrap>
      <DataTable aria-label="Read history" className="min-w-[1020px]">
        <TableHead>
          <TableHeaderCell>Read time</TableHeaderCell>
          <TableHeaderCell>Source</TableHeaderCell>
          <TableHeaderCell>Trigger</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Hash</TableHeaderCell>
          <TableHeaderCell>Integritas proof</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <td colSpan={7} className="p-0">
                <div className="p-margin-tight py-pad-relaxed">
                  <p className="type-body text-text-secondary m-0">
                    {filtered ? "No matching read history." : "No reads recorded yet."}
                  </p>
                </div>
              </td>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <time className="type-meta text-text-secondary" dateTime={item.createdAt}>
                    {formatLocalDateTime(item.createdAt)}
                  </time>
                </TableCell>
                <TableCell className="max-w-56 min-w-0">
                  <div className="gap-detail-tight flex min-w-0 flex-col">
                    <span className="type-body-em text-text-primary truncate">
                      {item.sourceName}
                    </span>
                    <code
                      className="type-mono text-text-secondary block truncate"
                      title={item.sourceUrl}
                    >
                      {item.sourceUrl}
                    </code>
                  </div>
                </TableCell>
                <TableCell>
                  <Pill>{item.triggerType}</Pill>
                </TableCell>
                <TableCell>
                  {item.status === "success" ? (
                    <Pill tone="good" indicator>
                      Success
                    </Pill>
                  ) : (
                    <Pill tone="error" indicator>
                      Failed
                    </Pill>
                  )}
                </TableCell>
                <TableCell className="max-w-48 min-w-0">
                  {item.hash ? (
                    <code
                      className="type-mono text-text-secondary block truncate"
                      title={item.hash}
                    >
                      {item.hash}
                    </code>
                  ) : (
                    <span className="text-text-secondary">No hash</span>
                  )}
                </TableCell>
                <TableCell className="max-w-40 min-w-0">
                  {item.integritasProofId ? (
                    <Text.Link to={proofHistoryLink(item.integritasProofId)} title="Go to proof">
                      Go to proof
                    </Text.Link>
                  ) : (
                    <span className="text-text-secondary">No proof</span>
                  )}
                </TableCell>
                <TableCell className="w-px whitespace-nowrap">
                  {item.preview ? (
                    <JsonPreview label="View" title="Read preview" value={item.preview} />
                  ) : item.error ? (
                    <div className="gap-detail-tight flex flex-col">
                      <ErrorDetails error={item.errorDetails ?? item.error} label="View error" />
                    </div>
                  ) : (
                    <span className="type-meta text-text-secondary">No data</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </DataTable>
    </TableWrap>
  );
}
