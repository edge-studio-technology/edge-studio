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

function isValidMxAddress(value: string): boolean {
  const decoded = decodeMinimaBase32(value);
  if (!decoded || decoded.length < 7 || decoded[0] !== 1) return false;

  const payloadLength = decoded.readInt16BE(1);
  if (payloadLength < 0) return false;
  if (decoded.length !== 3 + payloadLength + 4) return false;

  const payload = decoded.subarray(3, 3 + payloadLength);
  const checksum = decoded.subarray(3 + payloadLength);
  return checksum.toString("hex") === sha3HashHex(payload).slice(0, 8);
}

/** Returns true when value follows Minima's 0x or checksummed Mx address grammar. */
export function isMinimaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) return true;
  return /^mx/i.test(trimmed) && isValidMxAddress(trimmed);
}
