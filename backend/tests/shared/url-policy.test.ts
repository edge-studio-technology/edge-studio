import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns/promises", () => ({ default: { lookup: lookupMock } }));

const { assertAllowedEgressUrl, EgressUrlError, protectedAddressReason, resolveAllowedEgressAddresses } = await import(
  "../../src/shared/url-policy.js"
);

beforeEach(() => {
  lookupMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertAllowedEgressUrl", () => {
  it("accepts an ordinary external HTTPS URL", () => {
    const url = assertAllowedEgressUrl("https://api.vendor.example/v1/readings");
    assert.equal(url.hostname, "api.vendor.example");
  });

  it("accepts a plain LAN address, which stays reachable under this policy", () => {
    assert.equal(assertAllowedEgressUrl("http://192.168.1.50:8080/data").hostname, "192.168.1.50");
  });

  it("rejects the Minima RPC service name — the documented bypass", () => {
    assert.throws(() => assertAllowedEgressUrl("http://minima:9005/vault"), EgressUrlError);
  });

  for (const host of ["backend", "frontend", "mqtt", "update-agent", "localhost", "host.docker.internal"]) {
    it(`rejects the internal service name '${host}'`, () => {
      assert.throws(() => assertAllowedEgressUrl(`http://${host}/`), EgressUrlError);
    });
  }

  it("rejects a trailing-dot form of a service name", () => {
    assert.throws(() => assertAllowedEgressUrl("http://minima./status"), EgressUrlError);
  });

  it("rejects a mixed-case service name", () => {
    assert.throws(() => assertAllowedEgressUrl("http://MiNiMa:9005/status"), EgressUrlError);
  });

  for (const scheme of ["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/", "data:text/plain,hi"]) {
    it(`rejects the '${scheme.split(":")[0]}' scheme`, () => {
      assert.throws(() => assertAllowedEgressUrl(scheme), EgressUrlError);
    });
  }

  it("rejects a malformed URL", () => {
    assert.throws(() => assertAllowedEgressUrl("not a url"), EgressUrlError);
  });

  for (const literal of ["127.0.0.1", "127.5.5.5", "169.254.169.254", "0.0.0.0", "172.30.0.1", "172.30.0.7"]) {
    it(`rejects the protected IPv4 literal ${literal}`, () => {
      assert.throws(() => assertAllowedEgressUrl(`http://${literal}/`), EgressUrlError);
    });
  }

  for (const literal of ["[::1]", "[::]", "[fe80::1]", "[::ffff:127.0.0.1]", "[::ffff:172.30.0.5]"]) {
    it(`rejects the protected IPv6 literal ${literal}`, () => {
      assert.throws(() => assertAllowedEgressUrl(`http://${literal}/`), EgressUrlError);
    });
  }

  it("accepts a public IPv6 literal", () => {
    assert.equal(assertAllowedEgressUrl("http://[2606:4700::1111]/").hostname, "[2606:4700::1111]");
  });
});

describe("protectedAddressReason", () => {
  it("names the container network for a Compose-subnet address", () => {
    assert.match(protectedAddressReason("172.30.0.9") ?? "", /container network/);
  });

  it("returns null for a public address", () => {
    assert.equal(protectedAddressReason("93.184.216.34"), null);
  });

  it("treats an IPv4-mapped IPv6 address as its IPv4 form", () => {
    assert.ok(protectedAddressReason("::ffff:127.0.0.1"));
    assert.equal(protectedAddressReason("::ffff:93.184.216.34"), null);
  });
});

describe("resolveAllowedEgressAddresses", () => {
  it("returns every resolved address when all are public", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 }
    ]);

    const resolved = await resolveAllowedEgressAddresses(new URL("https://api.vendor.example/"));
    assert.deepEqual(resolved.map((entry) => entry.address), ["93.184.216.34", "93.184.216.35"]);
  });

  it("rejects when the SECOND A record is internal, not just the first", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "172.30.0.3", family: 4 }
    ]);

    await assert.rejects(
      () => resolveAllowedEgressAddresses(new URL("https://api.vendor.example/")),
      EgressUrlError
    );
  });

  it("rejects when a record is an IPv4-mapped loopback address", async () => {
    lookupMock.mockResolvedValue([{ address: "::ffff:127.0.0.1", family: 6 }]);
    await assert.rejects(() => resolveAllowedEgressAddresses(new URL("https://sneaky.example/")), EgressUrlError);
  });

  it("rejects when the host does not resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await assert.rejects(() => resolveAllowedEgressAddresses(new URL("https://nope.example/")), EgressUrlError);
  });

  it("rejects an empty answer", async () => {
    lookupMock.mockResolvedValue([]);
    await assert.rejects(() => resolveAllowedEgressAddresses(new URL("https://nope.example/")), EgressUrlError);
  });

  it("does not resolve an IP literal — it is already the address", async () => {
    const resolved = await resolveAllowedEgressAddresses(new URL("http://93.184.216.34/"));
    assert.deepEqual(resolved, [{ address: "93.184.216.34", family: 4 }]);
    assert.equal(lookupMock.mock.calls.length, 0);
  });
});
