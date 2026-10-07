import { sha3HashHex } from "./crypto.js";

function decodeMinimaBase32(value: string): Buffer | null {
  const encoded = value.slice(2).toLowerCase();
  if (!encoded || !/^[0-9a-wyz]+$/.test(encoded)) return null;

  const standard = encoded.replaceAll("w", "i").replaceAll("y", "l").replaceAll("z", "o");
  let decoded = 0n;
  for (const character of standard) {
    const digit = Number.parseInt(character, 32);
    if (!Number.isInteger(digit) || digit < 0 || digit >= 32) return null;
    decoded = decoded * 32n + BigInt(digit);
  }

  let hex = decoded.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  return Buffer.from(hex, "hex");
}

function decodeMxPayload(value: string): Buffer | null {
  const decoded = decodeMinimaBase32(value);
  if (!decoded || decoded.length < 7 || decoded[0] !== 1) return null;

  const payloadLength = decoded.readInt16BE(1);
  if (payloadLength < 0) return null;
  if (decoded.length !== 3 + payloadLength + 4) return null;

  const payload = decoded.subarray(3, 3 + payloadLength);
  const checksum = decoded.subarray(3 + payloadLength);
  return checksum.toString("hex") === sha3HashHex(payload).slice(0, 8) ? payload : null;
}

/** Returns the validated address bytes as lowercase hex, or null for an invalid address. */
export function canonicalMinimaAddress(value: string): string | null {
  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    const hex = trimmed.slice(2).toLowerCase();
    return `0x${hex.length % 2 === 0 ? hex : `0${hex}`}`;
  }
  if (!/^mx/i.test(trimmed)) return null;
  const payload = decodeMxPayload(trimmed);
  return payload ? `0x${payload.toString("hex")}` : null;
}

/** Returns true when value follows Minima's 0x or checksummed Mx address grammar. */
export function isMinimaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return true;
  return /^mx/i.test(trimmed) && decodeMxPayload(trimmed) !== null;
}
