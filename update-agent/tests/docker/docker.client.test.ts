import { describe, it, beforeEach, afterEach } from "vitest";
import * as assert from "node:assert/strict";
import { vi } from "vitest";
import http from "node:http";
import { dockerRequest, dockerRequestStream, type DockerProgressLine } from "../../src/docker/docker.client.js";
import { createMockHttpRequest, MockHttpRequestImpl, MockHttpResponse } from "../helpers/http-mock.js";

// Mock node:http
vi.mock("node:http", () => ({
  default: {
    request: vi.fn(),
  },
}));

describe("docker.client", () => {
  let mockRequest: MockHttpRequestImpl;
  let mockResponse: MockHttpResponse;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockHttpRequest();
    mockRequest = mocks.request;
    mockResponse = mocks.response;

    (http.request as any).mockImplementation((opts: Record<string, unknown>, cb: (res: unknown) => void) => {
      mockRequest.method = opts.method as string;
      mockRequest.path = opts.path as string;
      mockRequest.socketPath = opts.socketPath as string;
      mockRequest.headers = opts.headers as Record<string, string>;
      cb(mockResponse);
      return mockRequest;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("dockerRequest", () => {
    it("should send a GET request and parse JSON response", async () => {
      const expectedData = { id: "123", name: "container" };

      // Schedule response
      setImmediate(() => {
        mockResponse.emitData(JSON.stringify(expectedData));
        mockResponse.emitEnd();
      });

      const result = await dockerRequest("GET", "/containers/json");

      assert.deepEqual(result, expectedData);
      assert.equal(mockRequest.method, "GET");
      assert.equal(mockRequest.path, "/containers/json");
    });

    it("should send a POST request with body", async () => {
      const body = { Image: "ubuntu:latest" };
      const response = { Id: "container123" };

      setImmediate(() => {
        mockResponse.emitData(JSON.stringify(response));
        mockResponse.emitEnd();
      });

      const result = await dockerRequest("POST", "/containers/create", body);

      assert.deepEqual(result, response);
      assert.equal(mockRequest.method, "POST");
      assert.equal(mockRequest.path, "/containers/create");
      assert.deepEqual(mockRequest.write.mock.calls, [[JSON.stringify(body)]]);
    });

    it("should send a DELETE request", async () => {
      const response = {};

      setImmediate(() => {
        mockResponse.emitData(JSON.stringify(response));
        mockResponse.emitEnd();
      });

      const result = await dockerRequest("DELETE", "/containers/id123");

      assert.deepEqual(result, response);
      assert.equal(mockRequest.method, "DELETE");
    });

    it("should set Content-Type and Content-Length headers when body is provided", async () => {
      const body = { test: "data" };

      setImmediate(() => {
        mockResponse.emitData("{}");
        mockResponse.emitEnd();
      });

      await dockerRequest("POST", "/test", body);

      assert.equal(mockRequest.headers?.["Content-Type"], "application/json");
      assert.equal(mockRequest.headers?.["Content-Length"], Buffer.byteLength(JSON.stringify(body)));
    });

    it("should handle empty response body", async () => {
      setImmediate(() => {
        mockResponse.emitEnd();
      });

      const result = await dockerRequest("GET", "/test");

      assert.equal(result, undefined);
    });

    it("should reject on HTTP 400 error", async () => {
      mockResponse.setStatusCode(400);

      setImmediate(() => {
        mockResponse.emitData("Bad Request");
        mockResponse.emitEnd();
      });

      try {
        await dockerRequest("GET", "/test");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.match((error as Error).message, /HTTP 400/);
        assert.match((error as Error).message, /Bad Request/);
      }
    });

    it("should reject on HTTP 500 error", async () => {
      mockResponse.setStatusCode(500);

      setImmediate(() => {
        mockResponse.emitData("Internal Server Error");
        mockResponse.emitEnd();
      });

      try {
        await dockerRequest("GET", "/test");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.match((error as Error).message, /HTTP 500/);
      }
    });

    it("should reject on HTTP 301 redirect", async () => {
      mockResponse.setStatusCode(301);

      setImmediate(() => {
        mockResponse.emitData("");
        mockResponse.emitEnd();
      });

      try {
        await dockerRequest("GET", "/test");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.match((error as Error).message, /HTTP 301/);
      }
    });

    it("should reject on JSON parse error", async () => {
      setImmediate(() => {
        mockResponse.emitData("not valid json");
        mockResponse.emitEnd();
      });

      try {
        await dockerRequest("GET", "/test");
        assert.fail("Should have thrown");
      } catch (error) {
        assert.ok(error instanceof SyntaxError);
      }
    });

    it("should reject on request error", async () => {
      const error = new Error("Socket error");

      setImmediate(() => {
        mockRequest.emit("error", error);
      });

      try {
        await dockerRequest("GET", "/test");
        assert.fail("Should have thrown");
      } catch (e) {
        assert.equal((e as Error).message, "Socket error");
      }
    });

    it("should use custom timeout", async () => {
      setImmediate(() => {
        mockResponse.emitData("{}");
        mockResponse.emitEnd();
      });

      await dockerRequest("GET", "/test", undefined, 1000);

      assert.equal(mockRequest.setTimeout.mock.calls.length, 1);
      assert.equal(mockRequest.setTimeout.mock.calls[0]?.[0], 1000);
      assert.equal(typeof mockRequest.setTimeout.mock.calls[0]?.[1], "function");
    });

    it("should destroy the request and reject when the timeout fires", async () => {
      const promise = dockerRequest("GET", "/test", undefined, 1000);
      const timeoutHandler = mockRequest.setTimeout.mock.calls[0]?.[1] as () => void;

      timeoutHandler();

      await assert.rejects(promise, /Docker API GET \/test timed out/);
      assert.equal(mockRequest.destroy.mock.calls.length, 1);
      assert.match((mockRequest.destroy.mock.calls[0]?.[0] as Error).message, /GET \/test timed out/);
    });

    it("should call request.end()", async () => {
      setImmediate(() => {
        mockResponse.emitData("{}");
        mockResponse.emitEnd();
      });

      await dockerRequest("GET", "/test");

      assert.equal(mockRequest.end.mock.calls.length, 1);
    });

    it("should handle multi-chunk response", async () => {
      const expectedData = { large: "data".repeat(1000) };

      setImmediate(() => {
        const str = JSON.stringify(expectedData);
        const chunk1 = str.substring(0, str.length / 2);
        const chunk2 = str.substring(str.length / 2);
        mockResponse.emitData(chunk1);
        mockResponse.emitData(chunk2);
        mockResponse.emitEnd();
      });

      const result = await dockerRequest("GET", "/test");

      assert.deepEqual(result, expectedData);
    });
  });

  describe("dockerRequestStream", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      const mocks = createMockHttpRequest();
      mockRequest = mocks.request;
      mockResponse = mocks.response;

      (http.request as any).mockImplementation((opts: Record<string, unknown>, cb: (res: unknown) => void) => {
        cb(mockResponse);
        return mockRequest;
      });
    });

    it("should stream progress lines to callback", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        mockResponse.emitData('{"status":"Pulling from library/ubuntu"}\n');
        mockResponse.emitData('{"status":"Digest: sha256:abc123"}\n');
        mockResponse.emitEnd();
      });

      await promise;

      assert.equal(lines.length, 2);
      assert.equal(lines[0]?.status, "Pulling from library/ubuntu");
      assert.equal(lines[1]?.status, "Digest: sha256:abc123");
    });

    it("should parse progress objects with all fields", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        mockResponse.emitData(
          JSON.stringify({
            status: "Downloading",
            id: "layer123",
            progressDetail: { current: 5000000, total: 10000000 },
          }) + "\n"
        );
        mockResponse.emitEnd();
      });

      await promise;

      assert.equal(lines.length, 1);
      assert.equal(lines[0]?.status, "Downloading");
      assert.equal(lines[0]?.id, "layer123");
      assert.deepEqual(lines[0]?.progressDetail, { current: 5000000, total: 10000000 });
    });

    it("should reject if progress line has error", async () => {
      const promise = dockerRequestStream("/images/create");

      setImmediate(() => {
        mockResponse.emitData('{"error":"Failed to download layer"}\n');
      });

      try {
        await promise;
        assert.fail("Should have thrown");
      } catch (error) {
        assert.equal((error as Error).message, "Failed to download layer");
      }
    });

    it("should handle non-JSON lines (ignore silently)", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        mockResponse.emitData('{"status":"Downloading"}\n');
        mockResponse.emitData("some random output\n");
        mockResponse.emitData('{"status":"Done"}\n');
        mockResponse.emitEnd();
      });

      await promise;

      // Should only have 2 valid lines
      assert.equal(lines.length, 2);
      assert.equal(lines[0]?.status, "Downloading");
      assert.equal(lines[1]?.status, "Done");
    });

    it("should reject on HTTP error status", async () => {
      mockResponse.setStatusCode(500);

      const promise = dockerRequestStream("/images/create");

      setImmediate(() => {
        mockResponse.emitData("Internal error\n");
        mockResponse.emitEnd();
      });

      try {
        await promise;
        assert.fail("Should have thrown");
      } catch (error) {
        assert.match((error as Error).message, /HTTP 500/);
      }
    });

    it("should reject on request error", async () => {
      const error = new Error("Socket connection failed");

      const promise = dockerRequestStream("/images/create");

      setImmediate(() => {
        mockRequest.emit("error", error);
      });

      try {
        await promise;
        assert.fail("Should have thrown");
      } catch (e) {
        assert.equal((e as Error).message, "Socket connection failed");
      }
    });


    it("should handle partial lines across chunks", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        // Split JSON line across two chunks
        const json = '{"status":"Pulling","id":"layer1"}';
        mockResponse.emitData(json.substring(0, json.length / 2));
        mockResponse.emitData(json.substring(json.length / 2) + "\n");
        mockResponse.emitEnd();
      });

      await promise;

      assert.equal(lines.length, 1);
      assert.equal(lines[0]?.status, "Pulling");
      assert.equal(lines[0]?.id, "layer1");
    });

    it("should not invoke onProgress if not provided", async () => {
      const promise = dockerRequestStream("/images/create");

      setImmediate(() => {
        mockResponse.emitData('{"status":"Downloading"}\n');
        mockResponse.emitEnd();
      });

      // Should not throw
      await promise;
    });

    it("should ignore progress callbacks after error", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        mockResponse.emitData('{"error":"Failed"}\n');
        // Try to emit more after error (should be ignored)
        mockResponse.emitData('{"status":"Should not see this"}\n');
      });

      try {
        await promise;
      } catch {
        // Expected
      }

      // Should only have the error, no additional lines
      assert.equal(lines.length, 0);
    });

    it("should handle empty lines in stream", async () => {
      const lines: DockerProgressLine[] = [];

      const promise = dockerRequestStream("/images/create", 30000, (line) => {
        lines.push(line);
      });

      setImmediate(() => {
        mockResponse.emitData('{"status":"Start"}\n');
        mockResponse.emitData("\n\n"); // empty lines
        mockResponse.emitData('{"status":"End"}\n');
        mockResponse.emitEnd();
      });

      await promise;

      assert.equal(lines.length, 2);
    });

    it("should use POST method for stream requests", async () => {
      // Create fresh mocks for stream test
      const streamMocks = createMockHttpRequest();
      const streamRequest = streamMocks.request;
      const streamResponse = streamMocks.response;

      (http.request as any).mockImplementation((opts: Record<string, unknown>, cb: (res: unknown) => void) => {
        streamRequest.method = opts.method as string;
        cb(streamResponse);
        return streamRequest;
      });

      const promise = dockerRequestStream("/images/create");

      setImmediate(() => {
        streamResponse.emitEnd();
      });

      await promise;

      assert.equal(streamRequest.method, "POST");
    });

    it("should handle custom timeout for stream", async () => {
      const promise = dockerRequestStream("/images/create", 10000);

      setImmediate(() => {
        mockResponse.emitEnd();
      });

      await promise;

      assert.equal(mockRequest.setTimeout.mock.calls.length, 1);
      assert.equal(mockRequest.setTimeout.mock.calls[0]?.[0], 10000);
      assert.equal(typeof mockRequest.setTimeout.mock.calls[0]?.[1], "function");
      assert.equal(mockRequest.end.mock.calls.length, 1);
    });
  });
});
