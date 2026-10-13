import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";
import { createAlbumToken, passwordMatches, validEvent } from "./_album-auth.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const { event, password } = req.body || {};
  if (!validEvent(event) || typeof password !== "string" || !password) return json(res, 400, { error: "Evento o password non validi." });
  try {
    const supabase = supabaseAdmin();
    const { data: link, error: linkError } = await supabase.from("app_settings").select("value").eq("key", `event_link_${event.toLowerCase()}`).maybeSingle();
    if (linkError) throw linkError;
    if (link && link.value === false) return json(res, 403, { error: "Questo album al momento non è disponibile." });
    const { data, error } = await supabase.from("album_passwords").select("salt,password_hash").eq("event", event).maybeSingle();
    if (error) throw error;
    if (!data || !passwordMatches(password, data.salt, data.password_hash)) return json(res, 401, { error: "Password non corretta." });
    return json(res, 200, { ok: true, token: createAlbumToken(event), event });
  } catch (error) { console.error("event access error:", error?.message || error); return json(res, 500, { error: "Accesso non disponibile. Contatta l'organizzatore." }); }
}
