import dns from "node:dns/promises";
import { env } from "../config/env.js";

// Egress policy for operator-supplied URLs (data-source reads, health checks, HTTP output
// targets). It is deliberately narrow: it blocks the Compose-internal network, its gateway,
// and the container service names, so an API-writable URL cannot reach `minima`'s RPC port
// or any other internal service. Ordinary LAN and public destinations stay reachable.
//
// Deployment config (camera/sensor helper URLs from `.env`) is NOT subject to this policy —
// those point at the gateway on purpose. See docs/adr/0013.

export class EgressUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EgressUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Compose service names plus the loopback aliases that resolve inside the container.
const BLOCKED_HOSTNAMES = new Set([
  "backend",
  "frontend",
  "minima",
  "mqtt",
  "update-agent",
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "host.docker.internal"
]);

type Cidr = { base: number; mask: number };

function parseIpv4(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = result * 256 + octet;
  }

  return result >>> 0;
}

function parseCidr(value: string): Cidr | null {
  const [base, bitsText] = value.split("/");
  const baseInt = parseIpv4(base ?? "");
  const bits = Number(bitsText);
  if (baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { base: (baseInt & mask) >>> 0, mask };
}

function inCidr(address: number, cidr: Cidr) {
  return ((address & cidr.mask) >>> 0) === cidr.base;
}

const FIXED_V4_RANGES: Cidr[] = [
  parseCidr("127.0.0.0/8")!, // loopback
  parseCidr("169.254.0.0/16")!, // link-local
  parseCidr("0.0.0.0/8")! // unspecified / "this network"
];

function composeRanges(): Cidr[] {
  const ranges: Cidr[] = [];
  const subnet = parseCidr(env.dockerSubnet);
  if (subnet) ranges.push(subnet);

  const gateway = parseIpv4(env.dockerGateway);
  if (gateway !== null) ranges.push({ base: gateway, mask: 0xffffffff });

  return ranges;
}

function stripBrackets(address: string) {
  return address.trim().replace(/^\[/, "").replace(/\]$/, "").split("%")[0].toLowerCase();
}

/**
 * Expands an IPv6 literal to its 16 bytes. Written out rather than regex-matched because
 * `new URL()` re-serializes `::ffff:127.0.0.1` as `::ffff:7f00:1`, so a textual check for the
 * dotted form misses the very address it is meant to catch.
 */
function expandIpv6(address: string): Uint8Array | null {
  if (!address.includes(":")) return null;

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];

  // A trailing dotted-quad group (`::ffff:127.0.0.1`) is two groups, so expand it before
  // zero-filling — otherwise the fill is computed against the wrong group count.
  const last = halves.length === 2 ? tail : head;
  const trailing = last[last.length - 1];
  if (trailing?.includes(".")) {
    const v4 = parseIpv4(trailing);
    if (v4 === null) return null;
    last.splice(last.length - 1, 1, ((v4 >>> 16) & 0xffff).toString(16), (v4 & 0xffff).toString(16));
  }

  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail] : head;

  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < 8; index += 1) {
    const group = groups[index];
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = Number.parseInt(group, 16);
    bytes[index * 2] = (value >> 8) & 0xff;
    bytes[index * 2 + 1] = value & 0xff;
  }

  return bytes;
}

// Reduces an address literal to its IPv4 form where one exists, so `::ffff:127.0.0.1`,
// `::ffff:7f00:1`, and `127.0.0.1` are judged by the same rules.
function toIpv4(address: string): number | null {
  const trimmed = stripBrackets(address);
  const direct = parseIpv4(trimmed);
  if (direct !== null) return direct;

  const bytes = expandIpv6(trimmed);
  if (!bytes) return null;

  const prefixZero = bytes.slice(0, 10).every((byte) => byte === 0);
  if (!prefixZero) return null;

  const mapped = bytes[10] === 0xff && bytes[11] === 0xff;
  const compatible = bytes[10] === 0 && bytes[11] === 0;
  if (!mapped && !compatible) return null;

  const low = (bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15];
  // `::` and `::1` are IPv6 addresses in their own right, not IPv4-compatible forms.
  if (compatible && (low >>> 0) < 0x01000000) return null;

  return low >>> 0;
}

function protectedIpv6Reason(address: string): string | null {
  const trimmed = stripBrackets(address);
  const bytes = expandIpv6(trimmed);
  if (!bytes) return null;

  if (bytes.every((byte) => byte === 0)) return "the unspecified address";
  if (bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1) return "loopback";
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return "a link-local address";

  return null;
}

/** Returns a human-readable reason when the address is a protected internal destination. */
export function protectedAddressReason(address: string): string | null {
  const v4 = toIpv4(address);

  if (v4 === null) return protectedIpv6Reason(address);

  for (const range of FIXED_V4_RANGES) {
    if (inCidr(v4, range)) return "a loopback, link-local, or unspecified address";
  }

  for (const range of composeRanges()) {
    if (inCidr(v4, range)) return "the Edge Studio container network";
  }

  return null;
}

/**
 * String-level checks: scheme, credentials, service names, and IP literals. Callers that are
 * about to open a connection must also run `resolveAllowedEgressAddresses`.
 */
export function assertAllowedEgressUrl(rawUrl: string): URL {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new EgressUrlError(`'${rawUrl}' is not a valid URL`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new EgressUrlError(`URL scheme '${url.protocol.replace(":", "")}' is not allowed — use http or https`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) throw new EgressUrlError(`'${rawUrl}' has no host`);

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new EgressUrlError(`'${hostname}' is an internal Edge Studio service and cannot be used as a data source or output target`);
  }

  const literalReason = protectedAddressReason(hostname);
  if (literalReason) {
    throw new EgressUrlError(`'${hostname}' points at ${literalReason} and cannot be used as a data source or output target`);
  }

  return url;
}

export type ResolvedEgressAddress = { address: string; family: number };

/**
 * Resolves the host once and rejects if ANY returned address is protected — a name with one
 * public and one internal record must not be usable. The returned list is what the caller
 * pins to the socket, so the connection cannot land on a different answer.
 */
export async function resolveAllowedEgressAddresses(url: URL): Promise<ResolvedEgressAddress[]> {
  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  const literal = toIpv4(hostname) !== null || protectedIpv6Reason(hostname) !== null || hostname.includes(":");

  if (literal) {
    return [{ address: hostname, family: toIpv4(hostname) !== null ? 4 : 6 }];
  }

  let resolved: ResolvedEgressAddress[];

  try {
    resolved = await dns.lookup(hostname, { all: true });
  } catch {
    throw new EgressUrlError(`Could not resolve '${hostname}'`);
  }

  if (resolved.length === 0) throw new EgressUrlError(`Could not resolve '${hostname}'`);

  for (const entry of resolved) {
    const reason = protectedAddressReason(entry.address);
    if (reason) {
      throw new EgressUrlError(`'${hostname}' resolves to ${reason} and cannot be used as a data source or output target`);
    }
  }

  return resolved;
}
