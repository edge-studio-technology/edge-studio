import { Card } from "../../../components/Card";
import { cx } from "../../../lib/cx";

/** Setup-wizard panel — matches the centered Figma card (soft shadow, no forced min-height). */
export function OnboardingCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx("w-full max-w-[480px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]", className)}>
      {children}
    </Card>
  );
}
