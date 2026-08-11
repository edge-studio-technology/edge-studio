import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Maximize2, Minimize2, Settings, Trash2 } from "lucide-react";
import { LoadingDots } from "../../components/ui/LoadingDots";
import { IconButton } from "../../components/ui/Button";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { Tooltip } from "../../components/ui/Tooltip";
import { cx } from "../../lib/cx";
import { runConsoleCommand } from "./minimaConsoleApi";

type ScrollbackEntry = {
  id: string;
  command: string;
  status: "pending" | "ok" | "error" | "empty";
  payload?: unknown;
  error?: string;
  timestamp: string;
};

const shellClass =
  "border-surface-inverse-hover bg-surface-inverse type-mono text-text-inverse flex flex-col rounded-soft border";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// JSON.stringify escapes embedded newlines in string values as the two literal characters
// "\n" — valid JSON, but unreadable for multi-line help text (e.g. `logs help:`). Un-escape
// them for display; this is no longer strictly valid JSON, but it's meant to be read, not parsed.
function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/\\n/g, "\n");
}

// Minima RPC results are wrapped as { ok, status, source, command, body: { ...,
// response } }. The `response` field is the part an operator actually cares about;
// everything else is envelope/metadata worth keeping around but not front-and-center.
function extractResponse(payload: unknown): { response: unknown; envelope: unknown } {
  if (!isRecord(payload) || !isRecord(payload.body) || !("response" in payload.body)) {
    return { response: undefined, envelope: payload };
  }
  const { response, ...restBody } = payload.body;
  return { response, envelope: { ...payload, body: restBody } };
}

function ConsoleResult({ payload }: { payload: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const { response, envelope } = extractResponse(payload);

  if (response === undefined) {
    return (
      <pre className="text-text-inverse m-0 break-words whitespace-pre-wrap">
        {prettyJson(payload)}
      </pre>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-text-secondary hover:text-text-inverse cursor-pointer border-0 bg-transparent p-0"
      >
        {expanded ? "▾" : "▸"} Payload (response shown below)
      </button>
      {expanded && (
        <pre className="text-text-secondary mt-detail-tight m-0 break-words whitespace-pre-wrap">
          {prettyJson(envelope)}
        </pre>
      )}
      <pre className="text-text-inverse mt-detail-tight m-0 break-words whitespace-pre-wrap">
        {prettyJson(response)}
      </pre>
    </div>
  );
}

export function MinimaConsolePanel({
  disabled,
  onEditWhitelist,
}: {
  disabled?: boolean;
  onEditWhitelist: () => void;
}) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<ScrollbackEntry[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const running = entries.some((entry) => entry.status === "pending");

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || running) return;

    const trimmed = command.trim();
    setCommand("");

    // Every Enter press clears the line and records a scrollback entry — even an empty
    // one — the same way a real terminal always advances the prompt, whether or not
    // anything ran.
    if (!trimmed) {
      setEntries((current) => [
        {
          id: crypto.randomUUID(),
          command: "",
          status: "empty",
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
      return;
    }

    const id = crypto.randomUUID();
    setEntries((current) => [
      { id, command: trimmed, status: "pending", timestamp: new Date().toISOString() },
      ...current,
    ]);

    try {
      const result = await runConsoleCommand(trimmed);
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "ok", payload: result } : entry,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setEntries((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: "error", error: message } : entry,
        ),
      );
    }
  }

  // Clicking inside the scrollback to refocus the input is a nice touch, but doing it
  // unconditionally stole focus (and collapsed the selection highlight) after the mouseup
  // that ends a text-selection drag. Only refocus when the click isn't the tail end of a
  // selection.
  function focusInputUnlessSelecting() {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  }
  console.log(entries);
  const scrollback = (
    <ScrollArea className="p-pad-close flex-1" onClick={focusInputUnlessSelecting}>
      {entries.length === 0 ? (
        <p className="text-text-secondary m-0">No commands run yet.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="mb-detail-close last:mb-0">
            <div className="text-text-success">$ {entry.command}</div>
            {entry.status === "pending" && (
              <div className="text-text-secondary mt-2">
                <LoadingDots />
              </div>
            )}
            {entry.status === "error" && (
              <pre className="text-text-error m-0 break-words whitespace-pre-wrap">
                {entry.error}
              </pre>
            )}
            {entry.status === "ok" && <ConsoleResult payload={entry.payload} />}
          </div>
        ))
      )}
    </ScrollArea>
  );

  const promptRow = (
    <form
      onSubmit={(e) => void runCommand(e)}
      className="border-surface-inverse-hover gap-detail-next px-pad-close py-detail-next flex items-center border-b"
    >
      <span className="text-text-success">$</span>
      <input
        ref={inputRef}
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={disabled ? "Unavailable" : "status"}
        className="text-text-inverse placeholder:text-text-tertiary flex-1 bg-transparent outline-none disabled:opacity-55"
      />
      <Tooltip
        title="RPC console"
        body="Type a Minima RPC command and press Enter, e.g. status. Only commands enabled in the whitelist (gear icon) will run."
        placement="bottom"
      >
        <IconButton aria-label="RPC console instructions" size="compact" variant="secondary">
          <Info />
        </IconButton>
      </Tooltip>
      <IconButton
        aria-label="Clear scrollback"
        size="compact"
        variant="secondary"
        disabled={entries.length === 0 || running}
        onClick={() => setEntries([])}
      >
        <Trash2 />
      </IconButton>
      <IconButton
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        size="compact"
        variant="secondary"
        onClick={() => setFullscreen((value) => !value)}
      >
        {fullscreen ? <Minimize2 /> : <Maximize2 />}
      </IconButton>
      <IconButton
        aria-label="Edit console command whitelist"
        size="compact"
        variant="secondary"
        onClick={onEditWhitelist}
      >
        <Settings />
      </IconButton>
    </form>
  );

  return (
    <>
      {/* Keeps the in-flow layout occupying its usual height while fullscreen is
          portaled out — otherwise the page reflows/jumps when toggling fullscreen. */}
      <div className={cx(shellClass, "h-[28rem]")}>
        {fullscreen ? null : (
          <>
            {promptRow}
            {scrollback}
          </>
        )}
      </div>
      {fullscreen &&
        createPortal(
          <div
            className="bg-overlay-heavy p-pad-tight fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="RPC console, fullscreen"
          >
            <div
              className={cx(
                shellClass,
                "mx-auto h-full max-w-5xl shadow-[0_28px_80px_rgba(0,0,0,0.28)]",
              )}
            >
              {promptRow}
              {scrollback}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
