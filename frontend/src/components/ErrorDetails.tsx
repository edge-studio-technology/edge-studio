import { useState } from "react";
import { normalizeError } from "../lib/errors";
import { Modal } from "./Modal";

export function ErrorDetails({
  error,
  label = "View details",
}: {
  error: unknown;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="border-0 bg-transparent p-0 font-extrabold text-blue-600 underline"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <Modal title="Error details" onClose={() => setOpen(false)}>
          <ErrorDetailsContent error={error} />
        </Modal>
      )}
    </>
  );
}

/** Bare error-details sections, for callers composing their own modal/section around it. */
export function ErrorDetailsContent({ error }: { error: unknown }) {
  const normalized = normalizeError(error);

  return (
    <div className="grid gap-4">
      <section className="grid gap-1">
        <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">Type</span>
        <strong>{normalized.title}</strong>
      </section>
      <section className="grid gap-1">
        <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
          Message
        </span>
        <p className="m-0 text-slate-800">{normalized.message}</p>
      </section>
      {normalized.nativeMessage && normalized.nativeMessage !== normalized.message && (
        <section className="grid gap-1">
          <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
            Native details
          </span>
          <code className="rounded-xl bg-slate-200 p-3 break-words whitespace-pre-wrap text-slate-800">
            {normalized.nativeMessage}
          </code>
        </section>
      )}
      {(normalized.domain || normalized.nativeCode || normalized.occurredAt) && (
        <section className="grid gap-1">
          <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
            Context
          </span>
          <div className="grid gap-1 text-sm text-slate-700">
            <span>Domain: {normalized.domain}</span>
            <span>Error type: {normalized.type}</span>
            {normalized.nativeCode && <span>Native code: {normalized.nativeCode}</span>}
            {normalized.occurredAt && <span>Time: {normalized.occurredAt}</span>}
          </div>
        </section>
      )}
      {normalized.context && (
        <section className="grid gap-1">
          <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">
            Additional context
          </span>
          <pre className="m-0 overflow-visible rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] [overflow-wrap:anywhere] whitespace-pre-wrap text-blue-100">
            {JSON.stringify(normalized.context, null, 2)}
          </pre>
        </section>
      )}
      <section className="grid gap-1">
        <span className="text-xs font-bold tracking-[0.16em] text-slate-500 uppercase">Raw</span>
        <pre className="m-0 overflow-visible rounded-2xl bg-slate-900 p-3.5 text-[0.84rem] [overflow-wrap:anywhere] whitespace-pre-wrap text-blue-100">
          {JSON.stringify(normalized.raw, null, 2)}
        </pre>
      </section>
    </div>
  );
}
