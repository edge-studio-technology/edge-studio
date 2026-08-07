import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { MutedText } from "../Text";

/**
 * Pressable, outlined choice card: icon/eyebrow, title, description, optional extra
 * content, then an action label. The whole card is the click target.
 */
export function OptionCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  actionLabel,
  onClick,
  className,
  children,
}: {
  icon?: LucideIcon;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actionLabel: ReactNode;
  onClick: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx(
        "border-stroke-primary bg-surface-always-white rounded-soft p-pad-relaxed gap-detail-near hover:border-stroke-active justify-space flex min-h-96 flex-col justify-between text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]",
        "border",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        {eyebrow ? (
          <span className="type-meta text-text-tertiary font-bold tracking-wide uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h3 className="flex items-start gap-3 text-xl">
          {Icon && (
            <span className="bg-core-black text-core-white shrink-0 rounded-full p-2">
              <Icon size={24} aria-hidden />
            </span>
          )}
          <span className="place-self-center">{title}</span>
        </h3>
        {description ? <MutedText className="m-0">{description}</MutedText> : null}
      </div>
      {children}
      <span className="type-link text-text-accent no-underline">{actionLabel}</span>
    </button>
  );
}
