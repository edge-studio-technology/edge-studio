import type { ReactNode } from "react";
import { ScrollArea } from "../../../../components/ui/ScrollArea";
import { Text } from "../../../../components/ui/Text";
import { cx } from "../../../../lib/cx";

const railPanelClass =
  "bg-surface-always-white border-stroke-secondary grid h-full max-h-full content-start gap-detail-close rounded-soft border p-margin-tight shadow-[0_16px_40px_rgba(0,0,0,0.10)]";

export function WorkflowRailPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ScrollArea className={cx(railPanelClass, className)}>{children}</ScrollArea>;
}

export function WorkflowRailHeader({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="gap-detail-next grid">
      <Text.Title>{title}</Text.Title>
      <Text.Body className="text-text-secondary">{description}</Text.Body>
    </div>
  );
}
