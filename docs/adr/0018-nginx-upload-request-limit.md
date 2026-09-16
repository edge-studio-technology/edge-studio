# 0018: Derive The Nginx Upload Request Limit

**Status:** Accepted
**Date:** 2026-09-15

## Context

The backend limits each uploaded file with `UPLOAD_MAX_FILE_BYTES`, but browser uploads first pass
through the frontend Nginx proxy. Nginx's default one-megabyte request-body limit rejected ordinary
uploads before Multer could apply the configured limit, returning an HTML `413` that the browser
could only present as an unknown error.

An HTTP multipart request is larger than its file. It also contains non-file fields, per-part
headers, boundaries, and framing, so setting Nginx to the exact file limit would reject a file that
the backend is meant to accept.

## Decision

`UPLOAD_MAX_FILE_BYTES` remains the only operator-configured upload-size setting. The frontend
container receives it and `UPLOAD_MAX_FIELDS`, normalizes them to the same supported ranges as the
backend, and derives a total request allowance from:

- the configured file byte limit;
- one megabyte for each permitted non-file field, matching Multer's default field-size limit;
- 16 KiB of headers for each possible part; and
- 64 KiB for multipart boundaries and framing.

Only the three file-upload API locations receive the larger Nginx body limit. Other API and update
requests retain Nginx's default limit. The backend remains the authoritative file-size boundary and
returns the structured JSON `413` response.

Nginx version tokens are disabled independently of the request limit. This reduces passive version
disclosure but does not replace timely image updates.

## Alternatives considered

- **Use the exact file limit in Nginx.** Rejected because multipart overhead would make legitimate
  files at the configured boundary fail at the proxy.
- **Add a separately configurable Nginx limit.** Rejected because two operator-controlled values
  can drift and make the effective upload limit unclear.
- **Disable Nginx request limits.** Rejected because unauthenticated clients could consume
  unbounded proxy buffering and temporary storage before the backend sees the request.
- **Raise the limit for all `/api` requests.** Rejected because only three routes need large request
  bodies.

## Consequences

- Changing `UPLOAD_MAX_FILE_BYTES` changes both the backend file limit and the derived proxy request
  limit after the frontend and backend containers are recreated.
- Nginx may still reject a deliberately malformed multipart body whose non-file overhead exceeds
  the derived allowance. Normal uploads within the backend limits reach the backend.
- The proxy can buffer the configured file size plus bounded multipart overhead before
  authentication completes.

## Where this lives in code

- `docker-compose.yml`
- `scripts/release/build-docker-compose.mjs`
- `frontend/docker-entrypoint.d/15-edge-studio-upload-limit.envsh`
- `frontend/nginx.conf`
- `frontend/nginx-snippets/backend-proxy.conf`
