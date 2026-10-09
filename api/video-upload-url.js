import { randomUUID } from "node:crypto";
import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

const MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { event, mimeType, size, caption } = req.body || {};
  if (!["Cena", "Festa"].includes(event)) return json(res, 400, { error: "Seleziona un album valido." });
  if (!VIDEO_TYPES[mimeType]) return json(res, 415, { error: "Formato video non supportato. Usa MP4, MOV o WebM." });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return json(res, 413, { error: "Il video deve pesare al massimo 50 MB." });
  try {
    const supabase = supabaseAdmin();
    let reviewEnabled = true;
    const { data: setting, error: settingError } = await supabase.from("app_settings").select("value").eq("key", "review_enabled").maybeSingle();
    if (!settingError && setting) reviewEnabled = setting.value !== false;
    const id = randomUUID();
    const path = `${id}.${VIDEO_TYPES[mimeType]}`;
    const { data, error } = await supabase.storage.from("laurea-photos").createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;
    return json(res, 200, { id, path, token: data.token, signedUrl: data.signedUrl, status: reviewEnabled ? "pending" : "approved", event, mimeType, size, caption: String(caption || "").trim().slice(0, 180) });
  } catch (error) {
    console.error("video upload URL error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile preparare il caricamento del video." });
  }
}
