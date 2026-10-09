import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

export default async function handler(req, res) {
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
  const supabase = supabaseAdmin();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "review_enabled").maybeSingle();
      if (error) throw error;
      return json(res, 200, { reviewEnabled: data?.value !== false });
    } catch (error) {
      console.error("review setting read error:", error?.message || error);
      return json(res, 500, { error: "Impostazione revisione non disponibile. Esegui la migrazione SQL review_setting.sql su Supabase." });
    }
  }

  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const reviewEnabled = req.body?.reviewEnabled;
  if (typeof reviewEnabled !== "boolean") return json(res, 400, { error: "Impostazione non valida." });

  try {
    // Save the setting first: uploads arriving after this point follow the new mode.
    const { error: settingError } = await supabase.from("app_settings").upsert(
      { key: "review_enabled", value: reviewEnabled }, { onConflict: "key" }
    );
    if (settingError) throw settingError;

    let automaticallyApproved = 0;
    if (!reviewEnabled) {
      const { data, error } = await supabase.from("photos")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      automaticallyApproved = data?.length || 0;
    }
    return json(res, 200, { ok: true, reviewEnabled, automaticallyApproved });
  } catch (error) {
    console.error("review setting update error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile modificare la revisione. Controlla che la migrazione SQL sia stata eseguita su Supabase." });
  }
}
