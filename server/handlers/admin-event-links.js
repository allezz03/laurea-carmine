import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../../api/_supabase.js";

const EVENTS = ["Cena", "Festa", "Proclamazione"];
const DEFAULT_LINKS = { Cena: true, Festa: true, Proclamazione: true };
const settingKey = (eventName) => `event_link_${eventName.toLowerCase()}`;

async function readLinks(supabase) {
  const { data, error } = await supabase.from("app_settings").select("key,value").in("key", EVENTS.map(settingKey));
  if (error) throw error;
  const values = Object.fromEntries((data || []).map(row => [row.key, row.value]));
  return {
    Cena: values[settingKey("Cena")] !== false,
    Festa: values[settingKey("Festa")] !== false,
    Proclamazione: values[settingKey("Proclamazione")] !== false,
  };
}

export default async function handler(req, res) {
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
  const supabase = supabaseAdmin();
  if (req.method === "GET") {
    try { return json(res, 200, { eventLinks: await readLinks(supabase) }); }
    catch (error) {
      console.error("event links read error:", error?.message || error);
      return json(res, 500, { error: "Impostazione dei link non disponibile. Verifica che la tabella app_settings esista su Supabase." });
    }
  }
  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const links = req.body?.eventLinks;
  if (!links || typeof links.Cena !== "boolean" || typeof links.Festa !== "boolean" || typeof links.Proclamazione !== "boolean") return json(res, 400, { error: "Impostazione dei link non valida." });
  try {
    const rows = [
      { key: settingKey("Cena"), value: links.Cena, updated_at: new Date().toISOString() },
      { key: settingKey("Festa"), value: links.Festa, updated_at: new Date().toISOString() },
      { key: settingKey("Proclamazione"), value: links.Proclamazione, updated_at: new Date().toISOString() },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return json(res, 200, { ok: true, eventLinks: links });
  } catch (error) {
    console.error("event links update error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile salvare i link degli album." });
  }
}
