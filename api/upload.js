import Busboy from "busboy";
import { randomUUID } from "node:crypto";
import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

export const config = { api: { bodyParser: false } };
const MAX_BYTES = 12 * 1024 * 1024;
const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  let fileBuffer = null;
  let mimeType = "";
  let tooLarge = false;
  let eventName = "Festa";
  let caption = "";
  try {
    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_BYTES } });
      bb.on("field", (name, value) => { if (name === "event" && ["Cena", "Festa"].includes(value)) eventName = value;
        if (name === "caption") caption = String(value || "").trim().slice(0, 180); });
      bb.on("file", (_name, stream, info) => {
        mimeType = info.mimeType;
        const chunks = [];
        stream.on("data", chunk => chunks.push(chunk));
        stream.on("limit", () => { tooLarge = true; });
        stream.on("end", () => { fileBuffer = Buffer.concat(chunks); });
      });
      bb.on("error", reject);
      bb.on("finish", resolve);
      req.pipe(bb);
    });
    if (!fileBuffer?.length) return json(res, 400, { error: "Non è stata ricevuta nessuna foto." });
    if (tooLarge || fileBuffer.length > MAX_BYTES) return json(res, 413, { error: "La foto supera il limite di 12 MB." });
    const ext = MIME_EXT[mimeType];
    if (!ext) return json(res, 415, { error: "Formato non supportato. Usa JPG, PNG, WebP o HEIC." });

    const supabase = supabaseAdmin();
    // If the setting table is not migrated yet, preserve the safe current default: review enabled.
    let reviewEnabled = true;
    const { data: reviewSetting, error: reviewSettingError } = await supabase.from("app_settings").select("value").eq("key", "review_enabled").maybeSingle();
    if (!reviewSettingError && reviewSetting) reviewEnabled = reviewSetting.value !== false;
    const id = randomUUID();
    const path = `${id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("laurea-photos").upload(path, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;
    const status = reviewEnabled ? "pending" : "approved";
    const { error: dbError } = await supabase.from("photos").insert({ id, storage_path: path, status, mime_type: mimeType, size_bytes: fileBuffer.length, event: eventName, caption: caption || null, reviewed_at: reviewEnabled ? null : new Date().toISOString() });
    if (dbError) {
      await supabase.storage.from("laurea-photos").remove([path]);
      throw dbError;
    }
    return json(res, 201, { ok: true, status, message: reviewEnabled ? "Foto inviata per approvazione." : "Foto caricata e pubblicata nell'album." });
  } catch (error) {
    console.error("upload error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile caricare la foto. Riprova tra poco." });
  }
}