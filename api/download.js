import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

// Serve la foto approvata come allegato: il download= sull'URL Supabase
// cross-origin non è rispettato in modo uniforme dai browser mobili.
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const id = req.query?.id;
  if (typeof id !== "string" || !id.trim()) return json(res, 400, { error: "Foto non valida." });

  try {
    const supabase = supabaseAdmin();
    const { data: photo, error: lookupError } = await supabase
      .from("photos")
      .select("id, storage_path, event, status")
      .eq("id", id)
      .eq("status", "approved")
      .single();
    if (lookupError || !photo) return json(res, 404, { error: "Foto non trovata o non pubblicata." });

    const { data: file, error: downloadError } = await supabase.storage
      .from("laurea-photos")
      .download(photo.storage_path);
    if (downloadError || !file) throw downloadError || new Error("Download non riuscito.");

    const bytes = Buffer.from(await file.arrayBuffer());
    const type = file.type || "application/octet-stream";
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif", "image/avif": "avif" })[type] || "jpg";
    const eventName = photo.event === "Cena" ? "cena" : "festa";
    const filename = `laurea-carmine-${eventName}-${photo.id}.${extension}`;

    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(bytes);
  } catch (error) {
    console.error("photo download error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile scaricare la foto." });
  }
}
