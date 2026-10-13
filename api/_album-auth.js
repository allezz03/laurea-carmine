import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

const EVENTS = ["Cena", "Festa", "Proclamazione"];
const secret = () => process.env.ALBUM_ACCESS_SECRET || process.env.ADMIN_PASSWORD || "";
export const validEvent = (event) => EVENTS.includes(event);
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(String(password), salt, 64).toString("hex") };
}
export function passwordMatches(password, salt, hash) {
  try { const actual = scryptSync(String(password), salt, 64); const expected = Buffer.from(hash, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); } catch { return false; }
}
export function createAlbumToken(event) {
  const key = secret(); if (!key) throw new Error("ALBUM_ACCESS_SECRET non configurata.");
  const payload = Buffer.from(JSON.stringify({ event, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyAlbumToken(token, event) {
  try {
    const [payload, signature] = String(token || "").split("."); if (!payload || !signature || !secret()) return false;
    const expected = createHmac("sha256", secret()).update(payload).digest(); const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.event === event && data.exp > Date.now();
  } catch { return false; }
}
export function requireAlbum(req, event) {
  const token = req.headers["x-album-token"] || req.query?.token || req.body?.albumToken;
  return validEvent(event) && verifyAlbumToken(token, event);
}
