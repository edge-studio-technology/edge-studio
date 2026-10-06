import { getLocalWalletVerificationRevision, markLocalWalletVerificationPending } from "./address-book.repository.js";

let replacementsInFlight = 0;

export function isWalletReplacementInProgress(): boolean {
  return replacementsInFlight > 0;
}

export async function runWalletReplacement<T>(replace: () => Promise<T>): Promise<T> {
  const revision = markLocalWalletVerificationPending(true);
  replacementsInFlight += 1;
  try {
    const result = await replace();
    if (getLocalWalletVerificationRevision() === revision) markLocalWalletVerificationPending();
    return result;
  } finally {
    replacementsInFlight -= 1;
  }
}
