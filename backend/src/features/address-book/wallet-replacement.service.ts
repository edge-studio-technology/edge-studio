import { getLocalWalletVerificationRevision, markLocalWalletVerificationPending } from "./address-book.repository.js";

let replacementsInFlight = 0;
let replacementsFinished = 0;

export function isWalletReplacementInProgress(): boolean {
  return replacementsInFlight > 0;
}

/** Increases after every replacement attempt, successful or not; a value read before it changed may describe the old wallet. */
export function getWalletReplacementCount(): number {
  return replacementsFinished;
}

export async function runWalletReplacement<T>(replace: () => Promise<T>): Promise<T> {
  const dispatchedAt = Date.now();
  const revision = markLocalWalletVerificationPending(true, dispatchedAt);
  replacementsInFlight += 1;
  try {
    const result = await replace();
    if (getLocalWalletVerificationRevision() === revision) markLocalWalletVerificationPending(false, dispatchedAt);
    return result;
  } finally {
    replacementsInFlight -= 1;
    replacementsFinished += 1;
  }
}
