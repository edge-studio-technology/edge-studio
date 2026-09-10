import type { LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";
import { env } from "../config/env.js";
import { egressLimiter } from "./egress-limiter.js";
import {
  assertAllowedEgressUrl,
  EgressUrlError,
  resolveAllowedEgressAddresses,
  type ResolvedEgressAddress
} from "./url-policy.js";

const MAX_EGRESS_REDIRECTS = 3;

export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response exceeded the ${maxBytes} byte limit`);
    this.name = "ResponseTooLargeError";
  }
}

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

/**
 * Reads the body while counting bytes, and aborts the request the moment the cap is passed.
 * `Content-Length` is checked first but not trusted: it is the *encoded* length, it is absent on
 * chunked responses, and a remote server can simply lie. undici has already decompressed by the
 * time chunks reach here, so the count is of decoded bytes — a small gzip body that inflates past
 * the cap is still cut off mid-stream rather than after it has been buffered.
 */
async function readCappedText(response: UndiciResponse, maxBytes: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ResponseTooLargeError(maxBytes);
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ResponseTooLargeError(maxBytes);
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
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
 * It is also the single place outbound resource limits are enforced: a global concurrency
 * semaphore with a bounded queue, a clamped deadline covering the queue wait as well as the
 * request, and a decoded-byte cap on the response. See docs/adr/0017.
 *
 * Deployment-config URLs (camera/sensor helpers, Minima RPC, Integritas) do not go through
 * here — they are not API-writable. See docs/adr/0013.
 */
export async function fetchExternalJson(
  rawUrl: string,
  options: RequestInit = {},
  timeoutMs = env.egressTimeoutMs,
  maxRedirects = MAX_EGRESS_REDIRECTS
): Promise<{ response: UndiciResponse; text: string; body: unknown; finalUrl: string }> {
  const controller = new AbortController();
  // The deadline covers the queue wait too, so a saturated limiter fails callers fast instead of
  // holding workflow runs open for the queue's worth of upstream timeouts.
  const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, env.egressMaxTimeoutMs));
  const maxBytes = env.egressMaxResponseBytes;
  let target = rawUrl;

  try {
    return await egressLimiter.run(async () => {
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

          const text = await readCappedText(response, maxBytes);
          return { response, text, body: parseResponseBody(text), finalUrl: url.toString() };
        } finally {
          await agent.close().catch(() => {});
        }
      }

      throw new EgressUrlError(`Too many redirects (limit ${maxRedirects})`);
    });
  } finally {
    clearTimeout(timeout);
  }
}
