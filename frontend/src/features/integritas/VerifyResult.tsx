import { ResultShell } from "./ResultShell";
import { Pill } from "../../components/ui/Pill";

export type VerifyMatch = "full_match" | "no_match";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Read `data.verification.data.result` from the Integritas verify envelope. */
function readResultField(response: unknown): string | null {
  const root = asRecord(Array.isArray(response) ? response[0] : response);
  const verification = asRecord(asRecord(root?.data)?.verification);
  const value = asRecord(verification?.data)?.result;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

/** Map Integritas verify payload `result` to full match vs no match (anything else → no match). */
export function extractVerifyMatch(response: unknown): VerifyMatch {
  return readResultField(response) === "full match" ? "full_match" : "no_match";
}

export function VerifyResult({
  response,
  onClose,
}: {
  response: unknown;
  onClose: () => void;
}) {
  const match = extractVerifyMatch(response);
  const isFullMatch = match === "full_match";

  return (
    <ResultShell
      title="Verification result"
      description={
        isFullMatch
          ? "The proof matches the original data."
          : "The proof does not match."
      }
      ariaLabel="Verify result"
      tone={isFullMatch ? "good" : "error"}
      badge={
        <Pill tone={isFullMatch ? "good" : "error"} indicator>
          {isFullMatch ? "Full match" : "No match"}
        </Pill>
      }
      onClose={onClose}
    />
  );
}
