import { CheckCircle2, CircleX, Download, X } from "lucide-react";
import { contentStatePanelClass } from "../../components/patterns/EmptyContentState";
import { IconButton, LinkButton } from "../../components/ui/Button";
import { cx } from "../../lib/cx";

export type VerifyMatch = "full_match" | "no_match";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function verifyEnvelope(response: unknown): Record<string, unknown> | null {
  return asRecord(Array.isArray(response) ? response[0] : response);
}

/** Read `data.verification.data.result` from the Integritas verify envelope. */
function readResultField(response: unknown): string | null {
  const verification = asRecord(asRecord(verifyEnvelope(response)?.data)?.verification);
  const value = asRecord(verification?.data)?.result;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

/** Map Integritas verify payload `result` to full match vs no match (anything else → no match). */
export function extractVerifyMatch(response: unknown): VerifyMatch {
  return readResultField(response) === "full match" ? "full_match" : "no_match";
}

export function VerifyResult({ response, onClose }: { response: unknown; onClose: () => void }) {
  const match = extractVerifyMatch(response);
  const isFullMatch = match === "full_match";
  const url = asRecord(asRecord(verifyEnvelope(response)?.data)?.file)?.download_url;
  const reportUrl = typeof url === "string" && url ? url : null;
  const Icon = isFullMatch ? CheckCircle2 : CircleX;

  return (
    <div className={cx(contentStatePanelClass, "relative min-h-64")} aria-label="Verify result">
      <IconButton
        variant="ghost"
        size="compact"
        aria-label="Dismiss verify result"
        onClick={onClose}
        className="top-detail-next right-detail-next enabled:hover:border-stroke-primary absolute border-transparent"
      >
        <X aria-hidden />
      </IconButton>
      <Icon
        aria-hidden
        className={cx("size-8 shrink-0", isFullMatch ? "text-icon-success" : "text-icon-error")}
      />
      <div className="gap-detail-tight flex flex-col">
        <p className="type-body-em text-text-primary m-0">
          {isFullMatch ? "Full match" : "No match"}
        </p>
        <p className="type-body text-text-primary m-0">
          {isFullMatch ? "The proof matches the original data." : "The proof does not match."}
        </p>
      </div>
      {reportUrl ? (
        <LinkButton
          size="sm"
          href={reportUrl}
          rel="noopener noreferrer"
          iconStart={<Download aria-hidden />}
        >
          Download report
        </LinkButton>
      ) : null}
    </div>
  );
}
