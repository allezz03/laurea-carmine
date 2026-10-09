import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
  const { id, action } = req.body || {};
  if (typeof id !== "string" || !["approve", "reject", "delete"].includes(action)) return json(res, 400, { error: "Richiesta non valida." });
  try {
    const supabase = supabaseAdmin();
    const { data: photo, error: findError } = await supabase.from("photos").select("id, storage_path, status").eq("id", id).single();
    if (findError || !photo) return json(res, 404, { error: "Foto non trovata." });
    if (action === "approve" && photo.status !== "pending") return json(res, 409, { error: "Questa foto è già stata gestita." });
    if (action === "approve") {
      const { error } = await supabase.from("photos").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    } else if (action === "reject" && photo.status !== "pending") {
      return json(res, 409, { error: "Puoi rifiutare solo foto in attesa. Per le foto pubblicate usa Elimina." });
    } else {
      const { error: deleteError } = await supabase.from("photos").delete().eq("id", id);
      if (deleteError) throw deleteError;
      const { error: storageError } = await supabase.storage.from("laurea-photos").remove([photo.storage_path]);
      if (storageError) console.error("storage cleanup error:", storageError.message);
    }
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("moderation error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile gestire la foto." });
  }
}