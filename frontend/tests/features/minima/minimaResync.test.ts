import { describe, expect, it } from "vitest";
import type { MinimaCommandResult } from "../../../src/app/types";
import { parseMegammrResyncResult, resyncToastForResult } from "../../../src/features/minima/minimaResync";

function result(overrides: Partial<MinimaCommandResult> = {}): MinimaCommandResult {
  return {
    ok: true,
    source: "minima",
    ...overrides,
  };
}

describe("parseMegammrResyncResult", () => {
  it("is not rpcOk when result.ok is false", () => {
    const parsed = parseMegammrResyncResult(result({ ok: false, body: { status: true, response: {} } }));
    expect(parsed.rpcOk).toBe(false);
  });

  it("is not rpcOk when envelope.status is not true", () => {
    const parsed = parseMegammrResyncResult(result({ body: { status: false, response: {} } }));
    expect(parsed.rpcOk).toBe(false);
  });

  it("is rpcOk when result.ok and envelope.status are both true", () => {
    const parsed = parseMegammrResyncResult(result({ body: { status: true, response: {} } }));
    expect(parsed.rpcOk).toBe(true);
  });

  it("extracts and trims the response message", () => {
    const parsed = parseMegammrResyncResult(
      result({ body: { status: true, response: { message: "  Sync finished  " } } }),
    );
    expect(parsed.message).toBe("Sync finished");
  });

  it("defaults message to empty string when missing or non-object body/response", () => {
    expect(parseMegammrResyncResult(result({ body: undefined })).message).toBe("");
    expect(parseMegammrResyncResult(result({ body: "not an object" })).message).toBe("");
    expect(parseMegammrResyncResult(result({ body: { status: true, response: "nope" } })).message).toBe("");
  });

  it("detects needsRestart from a 'restart' mention in the message", () => {
    const parsed = parseMegammrResyncResult(
      result({ body: { status: true, response: { message: "Please restart the node" } } }),
    );
    expect(parsed.needsRestart).toBe(true);
  });

  it("detects finished from 'finish' or the known 'fininshed' typo", () => {
    expect(
      parseMegammrResyncResult(result({ body: { status: true, response: { message: "Resync finished" } } }))
        .finished,
    ).toBe(true);
    expect(
      parseMegammrResyncResult(result({ body: { status: true, response: { message: "Resync fininshed" } } }))
        .finished,
    ).toBe(true);
  });

  it("is neither needsRestart nor finished for an unrelated message", () => {
    const parsed = parseMegammrResyncResult(
      result({ body: { status: true, response: { message: "Processing" } } }),
    );
    expect(parsed.needsRestart).toBe(false);
    expect(parsed.finished).toBe(false);
  });
});

describe("resyncToastForResult", () => {
  it("returns an error toast when rpc failed, using the parsed message", () => {
    const toast = resyncToastForResult(result({ ok: false, body: { status: false, response: { message: "bad" } } }));
    expect(toast).toEqual({ tone: "error", title: "Megammr resync failed", message: "bad" });
  });

  it("falls back to a generic error message when none is parsed", () => {
    const toast = resyncToastForResult(result({ ok: false, body: undefined }));
    expect(toast.message).toBe("Minima RPC returned an error.");
  });

  it("returns a success toast noting container restart when restartedContainer is set", () => {
    const toast = resyncToastForResult(
      result({ body: { status: true, response: { message: "ok" } } }),
      { restartedContainer: true },
    );
    expect(toast.tone).toBe("success");
    expect(toast.title).toBe("Resync complete");
  });

  it("returns an info toast when the response indicates a restart is needed", () => {
    const toast = resyncToastForResult(
      result({ body: { status: true, response: { message: "will restart" } } }),
    );
    expect(toast.tone).toBe("info");
    expect(toast.title).toBe("Megammr resync complete");
  });

  it("returns a success toast with the message when finished", () => {
    const toast = resyncToastForResult(
      result({ body: { status: true, response: { message: "Resync finished" } } }),
    );
    expect(toast.tone).toBe("success");
    expect(toast.title).toBe("Megammr resync complete");
    expect(toast.message).toBe("Resync finished");
  });

  it("returns a requested success toast when rpcOk but not needsRestart/finished", () => {
    const toast = resyncToastForResult(
      result({ body: { status: true, response: { message: "Started" } } }),
    );
    expect(toast.tone).toBe("success");
    expect(toast.title).toBe("Megammr resync requested");
  });
});
