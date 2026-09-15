import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function generateTrackingCode(len = 8) {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function formatOrderNumber(seq: number, date = new Date()) {
  return `ORY-${date.getFullYear()}-${String(seq).padStart(6, "0")}`;
}
