import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const { data, error } = await supabaseAdmin().from("app_settings").select("value").eq("key", "event_links").maybeSingle();
    if (error) throw error;
    const value = data?.value || { Cena: true, Festa: true };
    return json(res, 200, { eventLinks: { Cena: value.Cena !== false, Festa: value.Festa !== false } });
  } catch (error) {
    console.error("public event links read error:", error?.message || error);
    return json(res, 200, { eventLinks: { Cena: true, Festa: true } });
  }
}
