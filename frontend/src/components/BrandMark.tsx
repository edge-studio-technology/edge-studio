const VARIANTS = {
  white: "/es_logo/svg/es-logo-white.svg",
  black: "/es_logo/svg/es-logo-black.svg",
  purple: "/es_logo/svg/es-logo-purple.svg",
} as const;

export function BrandMark({
  size = 24,
  variant = "purple",
}: {
  size?: number;
  variant?: keyof typeof VARIANTS;
}) {
  return <img src={VARIANTS[variant]} width={size} height={size} alt="" aria-hidden="true" />;
}
