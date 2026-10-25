import webpush from "web-push";
import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../_supabase.js";

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function setupWebPush() {
  if (!configured()) throw new Error("Notifiche non configurate: aggiungi le chiavi VAPID nelle variabili d'ambiente di Vercel.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

export default async function handler(req, res) {
  const action = req.query?.action || new URL(req.url, "http://localhost").pathname.split("/").filter(Boolean).at(-1);
  if (action === "subscribe") {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return json(res, 400, { error: "Iscrizione alle notifiche non valida." });
    }
    try {
      const supabase = supabaseAdmin();
      const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: subscription.endpoint, subscription }, { onConflict: "endpoint" });
      if (error) throw error;
      return json(res, 200, { ok: true });
    } catch (error) {
      console.error("push subscribe error:", error?.message || error);
      return json(res, 500, { error: "Non riesco a salvare l'iscrizione. Verifica di aver eseguito la migrazione SQL delle notifiche." });
    }
  }

  if (action === "send") {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
    try {
      setupWebPush();
      const supabase = supabaseAdmin();
      const { data: rows, error } = await supabase.from("push_subscriptions").select("endpoint, subscription");
      if (error) throw error;
      const payload = JSON.stringify({
        title: String(req.body?.title || "Laurea di Carmine").slice(0, 80),
        body: String(req.body?.body || "Il gioco sta per iniziare").slice(0, 180),
        url: "/"
      });
      let sent = 0;
      let removed = 0;
      for (const row of rows || []) {
        try {
          await webpush.sendNotification(row.subscription, payload, { TTL: 3600 });
          sent++;
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            const { error: deleteError } = await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
            if (!deleteError) removed++;
          } else {
            console.error("push send error:", error?.statusCode || "unknown", error?.message || error);
          }
        }
      }
      return json(res, 200, { ok: true, sent, removed, total: rows?.length || 0 });
    } catch (error) {
      console.error("push send setup error:", error?.message || error);
      return json(res, 500, { error: error?.message || "Non è stato possibile inviare le notifiche." });
    }
  }
  return json(res, 404, { error: "Azione notifiche non riconosciuta." });
}
