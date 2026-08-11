# Automation Inbox And Preview Block Plan

**Status:** V1 implemented  
**Created:** 2026-07-27  
**Goal:** Let workflows send local operator-facing messages, JSON, links, and image previews to the Edge Studio UI without requiring an external webhook such as Discord.

## Summary

Operators need a local way to see workflow output while building and running automations. Today, the practical workaround is sending data to an outbound HTTP/API target such as a Discord webhook. That is useful for remote notifications, but it should not be required just to inspect a sensor reading, preview an image, or surface a local alert.

Add a durable Automation Inbox plus a workflow action block that writes preview records into that inbox. If the browser is open, the frontend can show a live notification or popup. If the browser is closed, the record remains available for later review.

## Product Model

Use a workflow action block, not a device.

```txt
Show preview
Display a message, JSON, link, or image in the Pi UI.
```

The block writes an inbox item during workflow execution. The inbox item is linked to the workflow run and block that produced it.

This keeps the model clear:

- Devices represent configured input sources and output targets outside the app.
- Automation Inbox is a local UI surface for operator-facing workflow output.
- Workflow run history remains the audit/debug source for what happened.

## User Experience

### Block Library

Place `Show preview` under Action blocks.

```txt
Action blocks

Show preview
Display a message, JSON, link, or image in the Pi UI.
```

### Show Preview Inspector

Fields for V1:

```txt
Title
Temperature alert

Preview format
[Text]
[JSON]
[Link]
[Image]

Content source
[Custom]
[Workflow context]
[Trigger payload]
[Latest data]

Content
Temperature is {{temp}} C
```

Use the same variable interpolation rules as custom HTTP/MQTT output JSON for custom content.

Examples:

```txt
Title: Temperature alert
Preview format: Text
Content: Temperature is {{temp}} C
```

```txt
Title: Camera snapshot
Preview format: Image
Content: {{snapshotUrl}}
```

For local camera/file previews, store a local file path instead of an image blob:

```txt
Title: Local camera snapshot
Preview format: Image
Image source: Local file path
Content: camera/snapshot.jpg
```

```txt
Title: Raw MQTT payload
Preview format: JSON
Content source: Trigger payload
```

### Inbox UI

Add an Automation Inbox surface that shows recent preview items.

V1 placement options:

- Add an `Inbox` tab on the Automation page.
- Or add a compact inbox panel near workflow logs/diagnostics.

Recommended V1: add an `Inbox` tab on the Automation page because the feature is workflow-facing and should be easy to find while building workflows.

Inbox list item fields:

```txt
Title
Workflow name
Preview format
Created time
Read/unread state
Short preview
```

Inbox detail view:

```txt
Title
Workflow/run/block links
Created time
Rendered preview
Raw JSON details
Mark read / unread
Delete item
```

### Live Notification

If the app is open when a preview item is created, show a non-blocking live notification.

V1 can poll recent unread inbox items. WebSockets/SSE are not required for V1.

Live behavior:

- Show a toast or small popup for new unread items.
- Click opens the inbox item detail.
- Do not rely on the popup as the only record; the durable inbox item is the source of truth.

## Data Model

Add a SQLite table for inbox items.

```sql
CREATE TABLE automation_inbox_item (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  run_id TEXT,
  block_id TEXT,
  title TEXT NOT NULL,
  format TEXT NOT NULL,
  content_json TEXT NOT NULL,
  rendered_text TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (workflow_id) REFERENCES automation_workflow(id) ON DELETE CASCADE
);
```

Notes:

- `content_json` stores the canonical preview payload.
- `rendered_text` stores a short searchable/displayable text summary.
- Keep deleted items soft-deleted so accidental deletion can be audited later if needed.
- Preserve inbox items for deleted runs only if existing run-history retention expects that. Otherwise cascading with workflow deletion is acceptable for V1.

## Backend API

Add routes under the existing automation feature router.

```txt
GET /api/automation/inbox
GET /api/automation/inbox/:id
PATCH /api/automation/inbox/:id
DELETE /api/automation/inbox/:id
```

List query parameters:

```txt
status=unread|read|all
workflowId=...
format=text|json|link|image
limit=25
offset=0
```

Patch body:

```json
{
  "read": true
}
```

Response item shape:

```ts
type AutomationInboxItem = {
  id: string;
  workflowId: string;
  workflowName: string;
  runId: string | null;
  blockId: string | null;
  title: string;
  format: "text" | "json" | "link" | "image";
  content: unknown;
  renderedText: string | null;
  createdAt: string;
  readAt: string | null;
};
```

## Workflow Block Runtime

Add block type:

```ts
"show_preview"
```

Block config:

```ts
type ShowPreviewConfig = {
  title?: string;
  format?: "text" | "json" | "link" | "image";
  contentMode?: "custom" | "workflow_context" | "trigger_payload" | "latest_data";
  contentTemplateText?: string;
  imageSource?: "url" | "local_path";
};
```

Runtime behavior:

1. Resolve title with variable interpolation.
2. Resolve content from the selected content mode.
3. For `custom`, parse JSON for `json` format and use text for text/link/image URL formats.
4. Validate the resolved content matches the selected format.
5. Insert an inbox item linked to workflow/run/block.
6. Set `context.output` to a summary:

```json
{
  "action": "show_preview",
  "inboxItemId": "...",
  "format": "text",
  "title": "Temperature alert"
}
```

## Format Rules

### Text

Resolved content must be a string after interpolation.

### JSON

Resolved content can be any JSON value. Render with pretty-printing in the UI.

### Link

Resolved content must be an `http://` or `https://` URL string.

### Image

Image previews can reference either an `http://` / `https://` URL or a local file path under the configured host files root.

For URL images, the UI renders the URL directly:

```json
{
  "source": "url",
  "value": "http://192.168.1.50/snapshot.jpg"
}
```

For local path images, the database stores the path reference only. The browser loads the image through an authenticated backend route:

```txt
GET /api/automation/inbox/:id/image
```

The backend resolves the path under `HOST_FILES_ROOT`, rejects traversal outside that root, checks the file type, and streams the image.

Do not support raw base64 image blobs in V1. Large inline blobs can bloat SQLite and run logs.

## Validation

Validate on create/update and draft validation:

- Title is present and reasonably short.
- Format is one of `text`, `json`, `link`, `image`.
- Content mode is valid.
- `latest_data` mode requires a prior enabled record/fetch block.
- Custom JSON parses when format is `json`.
- Link custom content is syntactically a URL after interpolation at runtime.
- Image custom content is either a URL or a local path, depending on `imageSource`.
- Unknown variables fail the block clearly before writing an inbox item.

## Security And Safety

Preview content can come from untrusted webhook/MQTT payloads or fetched HTTP responses.

Controls for V1:

- Render text as escaped text, never as HTML.
- Render JSON as escaped/preformatted JSON.
- For links/images, only allow `http://` and `https://` URLs.
- Do not auto-fetch or proxy arbitrary images from the backend in V1; let the browser load image URLs directly.
- Avoid storing secrets in preview content. The block should not read settings/secrets directly.
- Keep routes authenticated like other automation APIs.

Open question for later hardening:

- Whether image/link previews should warn when the URL host is external to the LAN.

## V1 Implementation Plan

1. Add backend storage.
   Create `automation_inbox_item` migration and repository helpers for create/list/get/update/delete.

2. Add backend routes.
   Expose authenticated inbox list/detail/read/delete routes under automation.

3. Add block type and validation.
   Add `show_preview` to automation block type unions, config validation, and draft/workflow validation.

4. Add runtime execution.
   Resolve title/content, interpolate variables, write inbox item, and record the inbox item ID in block output.

5. Add frontend types/API client.
   Add inbox item types and API calls.

6. Add block library card and inspector.
   Add `Show preview` under Action blocks with title, format, content mode, and content fields.

7. Add inbox UI.
   Add Automation Inbox list/detail view with read/unread support and rendered previews.

8. Add live notification polling.
   Poll unread recent inbox items while the app is open and show a toast/popup that links to the item.

9. Update docs/changelog/security notes.
   Document local preview behavior, untrusted content rendering, and changelog entries.

## V1 Non-Goals

- No WebSockets/SSE requirement.
- No raw base64 image storage.
- No backend image proxying.
- No rich HTML/Markdown rendering.
- No cross-device push notifications.
- No mobile OS notifications.
- No per-user inbox routing; local authenticated users see the same automation inbox.

## Verification For Implementation

Run:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
```

Manual checks:

- Workflow writes a text preview using a custom string and variable interpolation.
- Workflow writes a JSON preview from trigger payload.
- Workflow writes an image URL preview from a variable.
- Inbox list shows unread items and detail renders the correct preview.
- Mark read/unread works.
- Delete hides the item from the default list.
- Unknown variables fail the block clearly and do not create an inbox item.
- Unsafe HTML is escaped in text/JSON preview rendering.
