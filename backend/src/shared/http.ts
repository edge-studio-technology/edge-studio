import type { LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";
import {
  assertAllowedEgressUrl,
  EgressUrlError,
  resolveAllowedEgressAddresses,
  type ResolvedEgressAddress
} from "./url-policy.js";

const MAX_EGRESS_REDIRECTS = 3;

// undici's connect lookup follows node:net's callback shape. Handing back only the addresses
// we already validated is what makes the check and the connection the same decision.
function pinnedLookup(addresses: ResolvedEgressAddress[]): LookupFunction {
  return ((_hostname: string, options: LookupOptions, callback: (...args: unknown[]) => void) => {
    if (options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  }) as unknown as LookupFunction;
}

export function parseResponseBody(responseText: string) {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

export async function fetchJsonWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { response, body: parseResponseBody(text) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The single egress path for operator-supplied URLs. Validates the URL, resolves the host
 * once, pins the validated address to the socket so a second resolver answer cannot move the
 * connection, and follows redirects manually so every hop is re-validated the same way.
 *
 * Deployment-config URLs (camera/sensor helpers, Minima RPC, Integritas) do not go through
 * here — they are not API-writable. See docs/adr/0013.
 */
export async function fetchExternalJson(
  rawUrl: string,
  options: RequestInit = {},
  timeoutMs = 5000,
  maxRedirects = MAX_EGRESS_REDIRECTS
): Promise<{ response: UndiciResponse; text: string; body: unknown; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let target = rawUrl;

  try {
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const url = assertAllowedEgressUrl(target);
      const addresses = await resolveAllowedEgressAddresses(url);
      const agent = new Agent({ connect: { lookup: pinnedLookup(addresses) } });

      let response: UndiciResponse;

      try {
        response = await undiciFetch(url, {
          ...(options as Parameters<typeof undiciFetch>[1]),
          signal: controller.signal,
          redirect: "manual",
          dispatcher: agent
        });

        const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;

        if (location) {
          await response.body?.cancel().catch(() => {});
          target = new URL(location, url).toString();
          continue;
        }

        const text = await response.text();
        return { response, text, body: parseResponseBody(text), finalUrl: url.toString() };
      } finally {
        await agent.close().catch(() => {});
      }
    }

    throw new EgressUrlError(`Too many redirects (limit ${maxRedirects})`);
  } finally {
    clearTimeout(timeout);
  }
}
