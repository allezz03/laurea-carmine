import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione Supabase mancante nelle variabili d'ambiente.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

export function checkAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const supplied = req.headers["x-admin-password"];
  return Boolean(expected && supplied && supplied === expected);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "Metodo non consentito." });
}
