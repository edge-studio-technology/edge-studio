import type { HTMLAttributes, ReactNode } from "react";
import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";
import { cx } from "../../lib/cx";

type TextElementProps = HTMLAttributes<HTMLElement> & { children: ReactNode };

export function TextTitle({ className, children, ...props }: TextElementProps) {
  return (
    <h2 className={cx("type-title text-text-primary m-0", className)} {...props}>
      {children}
    </h2>
  );
}

export function TextSubtitle({ className, children, ...props }: TextElementProps) {
  return (
    <p className={cx("type-callout m-0", className)} {...props}>
      {children}
    </p>
  );
}

export function TextBody({ className, children, ...props }: TextElementProps) {
  return (
    <p className={cx("type-body text-text-primary m-0", className)} {...props}>
      {children}
    </p>
  );
}

export function TextBodyEm({ className, children, ...props }: TextElementProps) {
  return (
    <p className={cx("type-body-em text-text-primary m-0", className)} {...props}>
      {children}
    </p>
  );
}

export function TextMuted({ className, children, ...props }: TextElementProps) {
  return (
    <p className={cx("type-meta text-text-secondary m-0", className)} {...props}>
      {children}
    </p>
  );
}

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
  Title: TextTitle,
  Subtitle: TextSubtitle,
  Body: TextBody,
  BodyEm: TextBodyEm,
  Muted: TextMuted,
  Link: TextLink,
} as const;
