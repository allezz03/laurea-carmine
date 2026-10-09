import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const eventName = req.query?.event;
    if (!["Cena", "Festa"].includes(eventName)) return json(res, 400, { error: "Seleziona un album valido." });
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("photos").select("id, storage_path, created_at, event").eq("status", "approved").eq("event", eventName).order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    const photos = await Promise.all((data || []).map(async photo => {
      const { data: signed, error: signError } = await supabase.storage.from("laurea-photos").createSignedUrl(photo.storage_path, 60 * 60);
      if (signError) return null;
      return { id: photo.id, url: signed.signedUrl, created_at: photo.created_at, event: photo.event };
    }));
    return json(res, 200, { photos: photos.filter(Boolean) });
  } catch (error) {
    console.error("gallery error:", error?.message || error);
    return json(res, 500, { error: "Galleria momentaneamente non disponibile." });
  }
}