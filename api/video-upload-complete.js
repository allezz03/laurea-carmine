import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/webm"]);
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { id, path, event, mimeType, size, caption } = req.body || {};
  if (typeof id !== "string" || !/^[0-9a-f-]{36}\.(mp4|mov|webm)$/i.test(path || "") || !path.startsWith(id + ".") || !["Cena", "Festa"].includes(event) || !ALLOWED.has(mimeType) || !Number.isFinite(size) || size <= 0 || size > 50 * 1024 * 1024) {
    return json(res, 400, { error: "Dati del video non validi." });
  }
  try {
    const supabase = supabaseAdmin();
    // Verify that the signed upload actually created the object, without proxying the video through Vercel.
    const { data: objects, error: listError } = await supabase.storage.from("laurea-photos").list("", { search: id, limit: 10 });
    if (listError) throw listError;
    const object = (objects || []).find(item => item.name === path);
    if (!object) return json(res, 400, { error: "Il video non risulta caricato. Riprova." });
    const actualSize = Number(object.metadata?.size || size);
    if (actualSize > 50 * 1024 * 1024) {
      await supabase.storage.from("laurea-photos").remove([path]);
      return json(res, 413, { error: "Il video supera il limite di 50 MB." });
    }
    let reviewEnabled = true;
    const { data: setting, error: settingError } = await supabase.from("app_settings").select("value").eq("key", "review_enabled").maybeSingle();
    if (!settingError && setting) reviewEnabled = setting.value !== false;
    const status = reviewEnabled ? "pending" : "approved";
    const { error: dbError } = await supabase.from("photos").insert({ id, storage_path: path, status, mime_type: mimeType, size_bytes: actualSize, event, caption: String(caption || "").trim().slice(0, 180) || null, media_type: "video", reviewed_at: reviewEnabled ? null : new Date().toISOString() });
    if (dbError) {
      await supabase.storage.from("laurea-photos").remove([path]);
      throw dbError;
    }
    return json(res, 201, { ok: true, status });
  } catch (error) {
    console.error("video upload complete error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile registrare il video. Riprova." });
  }
}
