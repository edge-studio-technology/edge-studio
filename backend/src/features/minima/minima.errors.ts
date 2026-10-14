export function normalizeMinimaRpcError(message: string) {
  if (/fetch failed|econnrefused|enotfound|etimedout|socket hang up|network|abort/i.test(message)) {
    return "Minima RPC is temporarily unreachable";
  }
  return message;
}

export class MinimaResyncConflictError extends Error {
  constructor() {
    super("A Minima operation is already active; wait for it to finish or check its progress.");
    this.name = "MinimaResyncConflictError";
  }
}
