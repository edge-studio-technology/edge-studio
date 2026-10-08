import { useState } from "react";
import type { ReactNode } from "react";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { cx } from "../../lib/cx";
import { parseChangelog } from "./changelog";
import type { ChangelogEntry } from "./changelog";

const REPO_URL = "https://github.com/edge-studio-technology/edge-studio";
const PREVIEW_LIMIT = 3;
const linkClass = "type-link text-text-accent hover:text-text-accent-hover transition-colors duration-200";

const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** Renders the small inline-markdown subset CHANGELOG.md actually uses: code, bold, links. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, code, bold, linkText, href] = match;
    if (code !== undefined) {
      nodes.push(
        <code key={key++} className="type-mono">
          {code}
        </code>,
      );
    } else if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (linkText !== undefined && href !== undefined) {
      const resolvedHref = href.startsWith("http") ? href : `${REPO_URL}/blob/main/${href.replace(/^\.\//, "")}`;
      nodes.push(
        <a key={key++} href={resolvedHref} target="_blank" rel="noreferrer" className={linkClass}>
          {linkText}
        </a>,
      );
    }
    lastIndex = INLINE_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function ChangelogEntryView({ entry, defaultOpen }: { entry: ChangelogEntry; defaultOpen: boolean }) {
  const headingMatch = /^\[(.+?)\]\s*(.*)$/.exec(entry.version);
  const label = headingMatch ? headingMatch[1] : entry.version;
  const meta = headingMatch ? headingMatch[2] : "";

  return (
    <Disclosure
      defaultOpen={defaultOpen}
      title={
        <span className="gap-detail-next flex items-baseline">
          <span>{label}</span>
          {meta ? <span className="type-meta text-text-secondary">{meta}</span> : null}
        </span>
      }
    >
      {entry.categories.map((category) => (
        <div key={category.name} className="gap-detail-tight flex flex-col">
          <h4 className="type-meta text-text-secondary m-0">{category.name}</h4>
          <ul className="gap-detail-tight m-0 flex list-disc flex-col pl-5">
            {category.items.map((item, index) => (
              <li key={index} className="type-body text-text-primary">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Disclosure>
  );
}

/**
 * `markdown` is update-agent's cached copy of CHANGELOG.md. See docs/adr/0031-cache-update-changelog-in-update-agent.md.
 * Renders as React elements, never HTML injection.
 */
export function ChangelogPreview({ markdown, onRetry }: { markdown: string | null; onRetry: () => void }) {
  const [fullOpen, setFullOpen] = useState(false);

  if (markdown === null) {
    return (
      <ErrorContentState
        title="Release notes aren't available"
        description="The update service hasn't downloaded the changelog yet."
        onRetry={onRetry}
      />
    );
  }

  const entries = parseChangelog(markdown, PREVIEW_LIMIT);

  return (
    <div className="gap-detail-close flex flex-col">
      {entries.map((entry, index) => (
        <ChangelogEntryView key={entry.version} entry={entry} defaultOpen={index === 0} />
      ))}
      <button type="button" className={cx(linkClass, "self-start")} onClick={() => setFullOpen(true)}>
        View full changelog
      </button>
      {fullOpen ? (
        <Modal title="Changelog" width="wide" onClose={() => setFullOpen(false)}>
          <div className="gap-detail-close flex flex-col">
            {parseChangelog(markdown).map((entry, index) => (
              <ChangelogEntryView key={entry.version} entry={entry} defaultOpen={index === 0} />
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
