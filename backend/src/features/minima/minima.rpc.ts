import { env } from "../../config/env.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { redactError, redactSecrets, redactStrings } from "../../shared/redact.js";

export type MinimaRpcResult = {
  ok: boolean;
  status: number;
  command: string;
  body: unknown;
};

export async function fetchMinimaStatus(timeoutMs = 5000): Promise<MinimaRpcResult> {
  const { response, body } = await fetchJsonWithTimeout(env.minimaStatusUrl, {}, timeoutMs);
  return {
    ok: response.ok,
    status: response.status,
    command: "status",
    body
  };
}

// command can carry a password (`backup ... password:"..."`) — redact before returning.
// body uses redactStrings, not redactDeep: its keys (`tokenid`, `token`) are Minima's data.
export async function runMinimaPathCommand(command: string, timeoutMs = 5000): Promise<MinimaRpcResult> {
  const url = new URL(env.minimaStatusUrl);
  url.pathname = `/${encodeURIComponent(command)}`;
  url.search = "";

  try {
    const { response, body } = await fetchJsonWithTimeout(url.toString(), {}, timeoutMs);
    return {
      ok: response.ok,
      status: response.status,
      command: redactSecrets(command),
      body: redactStrings(body)
    };
  } catch (error) {
    throw redactError(error);
  }
}
