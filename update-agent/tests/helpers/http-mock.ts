import { EventEmitter } from "node:events";
import { vi } from "vitest";
import type { IncomingMessage } from "node:http";

export class MockHttpRequestImpl extends EventEmitter {
  method?: string;
  path?: string;
  socketPath?: string;
  headers?: Record<string, string>;
  private timeoutHandle?: NodeJS.Timeout;

  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  setTimeout: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;

  constructor() {
    super();
    this.write = vi.fn(() => {});
    this.end = vi.fn(() => {});
    this.setTimeout = vi.fn((ms: number, handler: () => void) => {
      this.timeoutHandle = setTimeout(handler, ms);
    });
    this.destroy = vi.fn((error?: Error) => {
      if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
      if (error) this.emit("error", error);
    });
  }
}

export class MockHttpResponse extends EventEmitter {
  statusCode = 200;
  private encoding = "utf8";

  setEncoding = vi.fn((enc: string) => {
    this.encoding = enc;
  });

  emitData(chunk: string) {
    this.emit("data", chunk);
  }

  emitEnd() {
    this.emit("end");
  }

  emitError(error: Error) {
    this.emit("error", error);
  }

  setStatusCode(code: number) {
    this.statusCode = code;
  }
}

export function createMockHttpRequest(): {
  request: MockHttpRequestImpl;
  response: MockHttpResponse;
} {
  const request = new MockHttpRequestImpl();
  const response = new MockHttpResponse();

  return { request, response };
}

export function stubHttpRequest(
  handler: (opts: Record<string, unknown>, callback: (res: IncomingMessage) => void) => MockHttpRequestImpl
) {
  return vi.fn(handler);
}
