import type { ReactNode } from "react";

export function Page({
  eyebrow: _eyebrow,
  title,
  desc,
  action,
  children,
}: {
  /** @deprecated Unused. Drop when migrating each page call site. */
  eyebrow?: string;
  title: string;
  desc?: ReactNode;
  /** @deprecated Might be unused. Unused. Drop when migrating each page call site. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="gap-detail-close p-pad-distant flex w-full flex-col items-start">
      <header className="gap-detail-next grid w-full sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <h1 className="type-title text-text-primary m-0 min-w-0 sm:col-start-1">{title}</h1>
        {desc ? (
          <div className="type-body text-text-secondary m-0 min-w-0 sm:col-start-1">{desc}</div>
        ) : null}
        {action ? (
          <div className="shrink-0 sm:col-start-2 sm:row-span-2 sm:row-start-1">{action}</div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
