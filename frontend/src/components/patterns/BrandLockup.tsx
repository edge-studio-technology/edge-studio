import { APP_NAME } from "../../app/brand";
import { cx } from "../../lib/cx";

type BrandLockupTone = "on-dark" | "on-light";

/** `on-light`: dark wordmark + brand-purple icon, for light/white surfaces. `on-dark`: all-white, for the brand-gradient surface. */
const lockupSrc: Record<BrandLockupTone, string> = {
  "on-light": "/es_logo/svg/es-lockup.svg",
  "on-dark": "/es_logo/svg/es-lockup-white.svg",
};

/** Brand mark + wordmark lockup image, for full-screen brand surfaces (onboarding, login). */
export function BrandLockup({
  tone = "on-light",
  size = 32,
  className,
}: {
  tone?: BrandLockupTone;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={lockupSrc[tone]}
      alt={APP_NAME}
      style={{ height: size }}
      className={cx("w-auto", className)}
    />
  );
}
