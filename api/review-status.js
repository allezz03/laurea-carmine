import { supabaseAdmin, json, methodNotAllowed } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "review_enabled").maybeSingle();
    if (error) throw error;
    return json(res, 200, { reviewEnabled: data?.value !== false });
  } catch (error) {
    console.error("public review status error:", error?.message || error);
    // Keep the existing moderation behavior if the setting has not been migrated yet.
    return json(res, 200, { reviewEnabled: true });
  }
}
