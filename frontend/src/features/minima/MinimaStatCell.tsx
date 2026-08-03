import type { ReactNode } from "react";
import { Card } from "../../components/ui/Card";
import { cx } from "../../lib/cx";

export function MinimaStatCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-stroke-secondary rounded-soft p-pad-tight h-full border">
      <p className="type-meta text-text-primary m-0">{label}</p>
      <p className="type-callout text-text-primary mt-detail-tight mb-0">{value}</p>
    </div>
  );
}

export function MinimaStatGrid({
  title,
  footer,
  cols = "md:grid-cols-1",
  children,
}: {
  title: string;
  footer?: React.ReactNode;
  cols?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-detail-close flex h-full min-h-0 flex-col">
      <h3 className="type-title text-text-primary m-0">{title}</h3>
      <div className={cx("gap-detail-close grid flex-1 auto-rows-fr", cols)}>{children}</div>
      <div className="min-h-11">{footer}</div>
    </Card>
  );
}
