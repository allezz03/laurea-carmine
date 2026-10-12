import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

const DEFAULT_LINKS = { Cena: true, Festa: true };
export default async function handler(req, res) {
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
  const supabase = supabaseAdmin();
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "event_links").maybeSingle();
      if (error) throw error;
      const value = data?.value || DEFAULT_LINKS;
      return json(res, 200, { eventLinks: { Cena: value.Cena !== false, Festa: value.Festa !== false } });
    } catch (error) {
      console.error("event links read error:", error?.message || error);
      return json(res, 500, { error: "Impostazione dei link non disponibile. Verifica che la tabella app_settings esista su Supabase." });
    }
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const links = req.body?.eventLinks;
  if (!links || typeof links.Cena !== "boolean" || typeof links.Festa !== "boolean") return json(res, 400, { error: "Impostazione dei link non valida." });
  try {
    const { error } = await supabase.from("app_settings").upsert({ key: "event_links", value: links }, { onConflict: "key" });
    if (error) throw error;
    return json(res, 200, { ok: true, eventLinks: links });
  } catch (error) {
    console.error("event links update error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile salvare i link degli album." });
  }
}
