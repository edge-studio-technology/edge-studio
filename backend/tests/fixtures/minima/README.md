# Resync lifecycle envelopes

Captured on 2026-10-09 from fresh disposable Minima nodes. See [lifecycle evidence](../../../../docs/qa/536-resync-lifecycle.md) for image digests, architecture, timings, and limitations.

- `completed`: Core 1.1.2.4 (AMD64) and 1.1.2.6 (ARM64), HTTP 200. Exact legacy spelling and zero-coins response retained. Completion message preceded automatic Docker restart.
- `unreachableHost`: Core 1.1.2.4, 1.0.49.4, and 1.1.2.6, HTTP 200. This is an RPC rejection despite successful HTTP transport.

No seed, key, wallet identity, credentials, or production node data is included. Fixtures represent observed payloads, not proof that a request timeout establishes resync failure or success.
