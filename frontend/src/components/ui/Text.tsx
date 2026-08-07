import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";
import { cx } from "../../lib/cx";

/**
 * Text roles for product copy.
 *
 * Shipped now: `Text.Link`
 * Planned later: Body, Muted/Meta, Title, Mono, Error (reuse ErrorText).
 */

/** In-app text link (`type-link` + accent). Prefer this over bare router `Link` + type classes. */
export function TextLink({ className, ...props }: RouterLinkProps) {
  return (
    <RouterLink
      className={cx(
        "type-link text-text-accent hover:text-text-accent-hover transition-colors duration-200",
        className,
      )}
      {...props}
    />
  );
}

export const Text = {
  Link: TextLink,
  // Body, Muted, Title, Mono, Error — add when call sites need them
} as const;
