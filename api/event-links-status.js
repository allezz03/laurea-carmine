import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";
const settingKey = (eventName) => `event_link_${eventName.toLowerCase()}`;
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const { data, error } = await supabaseAdmin().from("app_settings").select("key,value").in("key", [settingKey("Cena"), settingKey("Festa")]);
    if (error) throw error;
    const values = Object.fromEntries((data || []).map(row => [row.key, row.value]));
    return json(res, 200, { eventLinks: { Cena: values[settingKey("Cena")] !== false, Festa: values[settingKey("Festa")] !== false } });
  } catch (error) {
    console.error("public event links read error:", error?.message || error);
    return json(res, 200, { eventLinks: { Cena: true, Festa: true } });
  }
}
