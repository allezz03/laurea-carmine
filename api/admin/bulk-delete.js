import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });

  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 600 || rawIds.some(id => typeof id !== "string" || !id.trim())) {
    return json(res, 400, { error: "Seleziona da 1 a 600 foto valide." });
  }
  const ids = [...new Set(rawIds)];
  try {
    const supabase = supabaseAdmin();
    const { data: photos, error: findError } = await supabase
      .from("photos")
      .select("id, storage_path, status")
      .in("id", ids)
      .eq("status", "approved");
    if (findError) throw findError;
    if (!photos?.length) return json(res, 404, { error: "Non sono state trovate foto pubblicate tra quelle selezionate." });

    const foundIds = photos.map(photo => photo.id);
    const { error: deleteError } = await supabase.from("photos").delete().in("id", foundIds).eq("status", "approved");
    if (deleteError) throw deleteError;

    const paths = photos.map(photo => photo.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("laurea-photos").remove(paths);
      if (storageError) console.error("bulk storage cleanup error:", storageError.message);
    }
    return json(res, 200, { ok: true, deleted: foundIds.length });
  } catch (error) {
    console.error("bulk delete error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile eliminare le foto selezionate." });
  }
}
