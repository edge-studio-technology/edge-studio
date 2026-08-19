import type { ReactNode } from "react";
import { normalizeError } from "../../lib/errors";
import { JsonPreviewContent } from "../JsonPreview";
import { DetailList, DetailRow } from "./DetailList";

/**
 * Minimal, ESDS-styled error breakdown: Message plus any caller-supplied rows (e.g. a
 * timestamp), for composing inside a caller's own modal/section. Error shapes differ across
 * source types, so everything beyond the message (type, domain, context, etc.) falls back
 * into the raw JSON block instead of being guessed at as separate fields.
 */
export function ErrorDetailPanel({ error, extraRows }: { error: unknown; extraRows?: ReactNode }) {
  const normalized = normalizeError(error);

  return (
    <div className="gap-detail-near grid">
      <DetailList>
        <DetailRow label="Message" value={normalized.message} />
        {extraRows}
      </DetailList>
      <JsonPreviewContent value={normalized.raw} />
    </div>
  );
}
