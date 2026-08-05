import { MinimaIcon } from "../../components/MinimaIcon";

function FilledHexTokenIcon({ size = 13, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M12 2.2 20.4 7v10L12 21.8 3.6 17V7L12 2.2Z" />
    </svg>
  );
}

export function TokenGlyph({ isNative }: { isNative: boolean }) {
  if (isNative) {
    return <MinimaIcon size={13} className="text-icon-tertiary shrink-0" />;
  }
  return <FilledHexTokenIcon size={13} className="text-icon-tertiary shrink-0" />;
}
