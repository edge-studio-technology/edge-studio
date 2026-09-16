import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { redactDeep, redactError, redactSecrets, redactStrings } from "../../src/shared/redact.js";

const SECRET = "sup3r-s3cret";

describe("redactSecrets", () => {
  it("redacts a quoted password argument in a Minima command string", () => {
    const redacted = redactSecrets(`backup file:backups/minima-manual-1.bak password:"${SECRET}"`);
    assert.equal(redacted.includes(SECRET), false);
    assert.ok(redacted.includes("backup file:backups/minima-manual-1.bak"));
    assert.ok(redacted.includes("password:[redacted]"));
  });

  it("redacts an unquoted password argument", () => {
    assert.equal(redactSecrets(`restoresync file:x.bak password:${SECRET}`).includes(SECRET), false);
  });

  it("redacts the percent-encoded form the command takes as a URL path", () => {
    const command = `backup file:backups/a.bak password:"${SECRET}"`;
    const url = `http://minima:9005/${encodeURIComponent(command)}`;
    const redacted = redactSecrets(url);
    assert.equal(redacted.includes(encodeURIComponent(SECRET)), false);
    assert.equal(redacted.includes(SECRET), false);
    assert.ok(redacted.startsWith("http://minima:9005/backup%20file%3Abackups%2Fa.bak%20password%3A"));
  });

  it("leaves a following argument intact after an encoded password", () => {
    const command = `restoresync file:a.bak password:"${SECRET}" host:megammr.minima.global:9001`;
    const redacted = redactSecrets(`http://minima:9005/${encodeURIComponent(command)}`);
    assert.equal(redacted.includes(encodeURIComponent(SECRET)), false);
    assert.ok(redacted.includes(encodeURIComponent("host:megammr.minima.global:9001")));
  });

  it("redacts credentials embedded in a broker URL's userinfo", () => {
    const redacted = redactSecrets(`mqtt://sensor:${SECRET}@broker.local:1883 devices/temp`);
    assert.equal(redacted.includes(SECRET), false);
    assert.ok(redacted.includes("mqtt://sensor:[redacted]@broker.local:1883"));
    assert.ok(redacted.includes("devices/temp"));
  });

  it("redacts bearer tokens", () => {
    assert.equal(redactSecrets(`Authorization: Bearer ${SECRET}`).includes(SECRET), false);
  });

  it("leaves ordinary URLs and messages untouched", () => {
    assert.equal(redactSecrets("http://minima:9005/status"), "http://minima:9005/status");
    assert.equal(redactSecrets("Minima RPC is temporarily unreachable"), "Minima RPC is temporarily unreachable");
  });

  it("redacts a quoted password containing spaces in its encoded form", () => {
    const spaced = "correct horse battery staple";
    const command = `backup file:backups/a.bak password:"${spaced}"`;
    const redacted = redactSecrets(`http://minima:9005/${encodeURIComponent(command)}`);
    assert.equal(redacted.includes("horse"), false, redacted);
    assert.equal(redacted.includes("battery"), false, redacted);
    assert.equal(redacted.includes("staple"), false, redacted);
  });

  it("redacts a quoted password containing spaces in its raw form", () => {
    const redacted = redactSecrets(`backup file:a.bak password:"correct horse battery" host:megammr:9001`);
    assert.equal(redacted.includes("horse"), false);
    assert.ok(redacted.includes("host:megammr:9001"));
  });

  it("redacts a wallet seed phrase argument in both forms", () => {
    const phrase = "apple banana cherry dog egg fig grape hat ice jam kite lemon";
    const command = `restore phrase:"${phrase}"`;
    assert.equal(redactSecrets(command).includes("apple"), false);
    assert.equal(redactSecrets(`http://minima:9005/${encodeURIComponent(command)}`).includes("apple"), false);
  });

  it("leaves a tokenid argument intact — it is a Minima token id, not a credential", () => {
    const command = "send amount:1 address:MxABC tokenid:0x00";
    assert.equal(redactSecrets(command), command);
  });

  it("is idempotent", () => {
    const once = redactSecrets(`backup file:a.bak password:"${SECRET}"`);
    assert.equal(redactSecrets(once), once);
  });
});

describe("redactDeep", () => {
  it("redacts values under secret-looking keys regardless of shape", () => {
    const out = redactDeep({ backupPassword: SECRET, apiKey: SECRET, fileName: "a.bak", count: 3 });
    assert.deepEqual(out, { backupPassword: "[redacted]", apiKey: "[redacted]", fileName: "a.bak", count: 3 });
  });

  it("redacts secret patterns in nested strings and arrays", () => {
    const out = redactDeep({ result: { command: `backup file:a.bak password:"${SECRET}"` }, peers: [`mqtt://u:${SECRET}@h:1883`] });
    assert.equal(JSON.stringify(out).includes(SECRET), false);
  });

  it("keys are matched on whole words, so tokenid and tokens survive", () => {
    const out = redactDeep({ tokenid: "0x00", tokenId: "0xFEED", tokens: ["a"], token: "Minima", pin: 17 });
    assert.deepEqual(out, { tokenid: "0x00", tokenId: "0xFEED", tokens: ["a"], token: "Minima", pin: 17 });
  });

  it("still redacts qualified credential token keys", () => {
    const out = redactDeep({ accessToken: SECRET, refresh_token: SECRET, webhookToken: SECRET, apiKey: SECRET });
    assert.equal(JSON.stringify(out).includes(SECRET), false);
  });

  it("replaces a subtree past the depth limit rather than returning it unread", () => {
    let deep: Record<string, unknown> = { brokerUrl: `mqtt://u:${SECRET}@h:1883` };
    for (let i = 0; i < 25; i += 1) deep = { nested: deep };
    assert.equal(JSON.stringify(redactDeep(deep)).includes(SECRET), false);
  });

  it("passes through null and non-objects", () => {
    assert.equal(redactDeep(null), null);
    assert.equal(redactDeep(7), 7);
  });
});

describe("redactError", () => {
  it("returns a redacted error and drops the cause chain", () => {
    const original = new Error(`request to http://minima:9005/${encodeURIComponent(`backup password:"${SECRET}"`)} failed`, {
      cause: new Error(`connect ECONNREFUSED ${SECRET}`)
    });
    const redacted = redactError(original) as Error & { cause?: unknown };

    assert.ok(redacted instanceof Error);
    assert.equal(redacted.message.includes(SECRET), false);
    assert.equal(redacted.message.includes(encodeURIComponent(SECRET)), false);
    assert.equal(redacted.cause, undefined);
  });

  it("returns the original error untouched when nothing needed redacting", () => {
    const original = new Error("fetch failed");
    assert.equal(redactError(original), original);
  });

  it("preserves the error name and code", () => {
    const original = new Error(`password:"${SECRET}"`) as NodeJS.ErrnoException;
    original.name = "TypeError";
    original.code = "ECONNREFUSED";
    const redacted = redactError(original) as NodeJS.ErrnoException;
    assert.equal(redacted.name, "TypeError");
    assert.equal(redacted.code, "ECONNREFUSED");
  });
});

describe("redactStrings", () => {
  it("scrubs strings without blanking keys it does not own", () => {
    const body = { response: [{ tokenid: "0x00", token: "Minima", note: `password:"${SECRET}"` }] };
    const out = redactStrings(body) as typeof body;
    assert.equal(out.response[0].tokenid, "0x00");
    assert.equal(out.response[0].token, "Minima");
    assert.equal(out.response[0].note.includes(SECRET), false);
  });

  it("replaces a subtree past the depth limit rather than returning it unread", () => {
    let deep: Record<string, unknown> = { note: `password:"${SECRET}"` };
    for (let i = 0; i < 25; i += 1) deep = { nested: deep };
    assert.equal(JSON.stringify(redactStrings(deep)).includes(SECRET), false);
  });
});
