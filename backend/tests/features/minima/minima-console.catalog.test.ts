import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { excludedConsoleCommandVerbs, minimaConsoleCatalog } from "../../../src/features/minima/minima-console.catalog.js";

describe("minimaConsoleCatalog", () => {
  it("has unique keys", () => {
    const keys = minimaConsoleCatalog.map((entry) => entry.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("only default-enables read-only commands", () => {
    for (const entry of minimaConsoleCatalog) {
      if (entry.defaultEnabled) assert.equal(entry.kind, "read");
    }
  });

  it("never includes a permanently excluded verb", () => {
    const verbs = new Set(minimaConsoleCatalog.map((entry) => entry.verb));
    for (const excluded of excludedConsoleCommandVerbs) {
      assert.equal(verbs.has(excluded), false);
    }
  });

  it("dispatches backup/restoresync/megammrsync.resync as write, default-disabled special actions", () => {
    const backup = minimaConsoleCatalog.find((entry) => entry.key === "backup");
    const restoresync = minimaConsoleCatalog.find((entry) => entry.key === "restoresync");
    const megammrResync = minimaConsoleCatalog.find((entry) => entry.key === "megammrsync.resync");

    assert.equal(backup?.dispatch, "backup");
    assert.equal(backup?.defaultEnabled, false);
    assert.equal(restoresync?.dispatch, "restoresync");
    assert.equal(restoresync?.defaultEnabled, false);
    assert.equal(megammrResync?.dispatch, "megammrsync-resync");
    assert.equal(megammrResync?.verb, "megammrsync");
    assert.equal(megammrResync?.defaultEnabled, false);
  });

  it("peers.add only matches when action:addpeers is present, and is write/default-disabled", () => {
    const peersAdd = minimaConsoleCatalog.find((entry) => entry.key === "peers.add");
    assert.equal(peersAdd?.dispatch, "peers-add");
    assert.equal(peersAdd?.kind, "write");
    assert.equal(peersAdd?.defaultEnabled, false);
    assert.equal(peersAdd?.match?.("peers action:addpeers peerslist:1.2.3.4:9001"), true);
    assert.equal(peersAdd?.match?.("peers"), false);
  });

  it("bare peers entry is read, default-enabled, and has no match guard", () => {
    const peers = minimaConsoleCatalog.find((entry) => entry.key === "peers");
    assert.equal(peers?.kind, "read");
    assert.equal(peers?.defaultEnabled, true);
    assert.equal(peers?.match, undefined);
  });
});
