import { JsonPreviewContent } from "../../components/JsonPreview";
import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { normalizeError } from "../../lib/errors";
import { formatLocalDateTime } from "../../lib/time";
import type { DataSourceHealthStatus } from "./dataSourceTypes";

/**
 * Minimal breakdown of a failed device health check: Message + Checked at only. The rest
 * (status code, source, body) isn't guaranteed the same shape across target types, so it
 * falls back into the raw JSON block instead of being guessed at as separate fields.
 */
export function HealthErrorPanel({ status }: { status: DataSourceHealthStatus }) {
  const normalized = normalizeError(status.errorDetails ?? status.error);

  return (
    <div className="gap-detail-near grid">
      <DetailList>
        <DetailRow label="Message" value={normalized.message} />
        {status.checkedAt && (
          <DetailRow label="Checked at" value={formatLocalDateTime(status.checkedAt)} />
        )}
      </DetailList>
      <JsonPreviewContent value={status.body !== undefined ? status.body : status} />
    </div>
  );
}
