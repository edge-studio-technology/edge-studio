export function compareDecimalStrings(a: string, b: string): number {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === ".") return { int: "0", frac: "" };
    const [intPart = "0", fracPart = ""] = trimmed.split(".");
    return {
      int: intPart.replace(/^0+(?=\d)/, "") || "0",
      frac: fracPart,
    };
  };
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  const fracLen = Math.max(aNorm.frac.length, bNorm.frac.length);
  const aCombined = `${aNorm.int}${aNorm.frac.padEnd(fracLen, "0")}`;
  const bCombined = `${bNorm.int}${bNorm.frac.padEnd(fracLen, "0")}`;
  if (aCombined === bCombined) return 0;
  return BigInt(aCombined) > BigInt(bCombined) ? 1 : -1;
}

export function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return false;
  return compareDecimalStrings(trimmed, "0") > 0;
}

export function isNativeTokenId(tokenId: string): boolean {
  return tokenId.trim().toLowerCase() === "0x00";
}

export function shortAddress(value: string): string {
  if (value.length <= 18) return value;
  if (value.startsWith("Mx")) return `${value.slice(0, 8)}…${value.slice(-6)}`;
  if (value.startsWith("0x")) return `${value.slice(0, 10)}…${value.slice(-6)}`;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
