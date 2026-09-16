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

  // Finding [10]: command lookup keys on the first token, so a read-classified verb that
  // accepts a mutating `action:` form needs a sibling write entry ahead of it in the catalog.
  describe("verbs whose action: argument can mutate", () => {
    function entriesFor(verb: string) {
      return minimaConsoleCatalog.filter((entry) => entry.verb === verb);
    }

    it("lists the tokens write entry before the read entry, so action:import cannot slip through", () => {
      const [first, second] = entriesFor("tokens");
      assert.equal(first.key, "tokens.write");
      assert.equal(first.kind, "write");
      assert.equal(first.defaultEnabled, false);
      assert.equal(first.match?.("tokens action:import data:0x123"), true);
      assert.equal(first.match?.("tokens action:export tokenid:0x00"), false);
      assert.equal(first.match?.("tokens"), false);
      assert.equal(second.key, "tokens");
      assert.equal(second.defaultEnabled, true);
    });

    it("claims unknown tokens actions for the write entry rather than allowing them", () => {
      const [first] = entriesFor("tokens");
      assert.equal(first.match?.("tokens action:somethingnew"), true);
    });

    it("lists the maxcontacts write entry before the read entry", () => {
      const [first, second] = entriesFor("maxcontacts");
      assert.equal(first.key, "maxcontacts.write");
      assert.equal(first.defaultEnabled, false);
      assert.equal(first.match?.("maxcontacts action:add contact:MAX#..."), true);
      assert.equal(first.match?.("maxcontacts action:remove id:1"), true);
      assert.equal(first.match?.("maxcontacts action:list"), false);
      assert.equal(first.match?.("maxcontacts action:search"), false);
      assert.equal(second.key, "maxcontacts");
      assert.equal(second.defaultEnabled, true);
    });

    it("classifies cointrack as write — it has no read form", () => {
      const [cointrack] = entriesFor("cointrack");
      assert.equal(cointrack.kind, "write");
      assert.equal(cointrack.defaultEnabled, false);
    });

    it("is case-insensitive about the action value", () => {
      const [tokens] = entriesFor("tokens");
      assert.equal(tokens.match?.("tokens ACTION:IMPORT"), true);
      assert.equal(tokens.match?.("tokens ACTION:EXPORT"), false);
    });
  });

  it("bare peers entry is read, default-enabled, and has no match guard", () => {
    const peers = minimaConsoleCatalog.find((entry) => entry.key === "peers");
    assert.equal(peers?.kind, "read");
    assert.equal(peers?.defaultEnabled, true);
    assert.equal(peers?.match, undefined);
  });
});
