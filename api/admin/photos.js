import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("photos").select("id, storage_path, created_at, status, event, caption").in("status", ["pending", "approved"]).order("created_at", { ascending: false }).limit(600);
    if (error) throw error;
    const photos = await Promise.all((data || []).map(async photo => {
      const { data: signed, error: signError } = await supabase.storage.from("laurea-photos").createSignedUrl(photo.storage_path, 60 * 60);
      if (signError) return null;
      return { id: photo.id, url: signed.signedUrl, created_at: photo.created_at, status: photo.status, event: photo.event || "Festa", caption: photo.caption || "" };
    }));
    const available = photos.filter(Boolean);
    return json(res, 200, { photos: available, pending: available.filter(p => p.status === "pending"), approved: available.filter(p => p.status === "approved") });
  } catch (error) {
    console.error("admin photos error:", error?.message || error);
    return json(res, 500, { error: "Non riesco a caricare le foto in revisione." });
  }
}