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
    const nickname = String(req.body?.nickname || "").trim().slice(0, 40);
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return json(res, 400, { error: "Iscrizione alle notifiche non valida." });
    }
    try {
      const supabase = supabaseAdmin();
      const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: subscription.endpoint, subscription, nickname: nickname || null }, { onConflict: "endpoint" });
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
      const target = req.body?.target === "nickname" ? "nickname" : "all";
      const nickname = String(req.body?.nickname || "").trim().slice(0, 40);
      if (target === "nickname" && !nickname) return json(res, 400, { error: "Inserisci il soprannome del destinatario." });
      let query = supabase.from("push_subscriptions").select("endpoint, subscription, nickname");
      if (target === "nickname") query = query.ilike("nickname", nickname);
      const { data: rows, error } = await query;
      if (error) throw error;
      const title = String(req.body?.title || "Laurea di Carmine").trim().slice(0, 80);
      const body = String(req.body?.body || "Il gioco sta per iniziare").trim().slice(0, 180);
      if (!title || !body) return json(res, 400, { error: "Inserisci titolo e messaggio." });
      const url = String(req.body?.url || "/").startsWith("/") ? String(req.body?.url || "/").slice(0, 200) : "/";
      let sent = 0, removed = 0, failed = 0;
      for (const row of rows || []) {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }), { TTL: 3600 });
          sent++;
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            const { error: deleteError } = await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
            if (!deleteError) removed++;
          } else { failed++; console.error("push send error:", error?.statusCode || "unknown", error?.message || error); }
        }
      }
      return json(res, 200, { ok: true, sent, removed, failed, total: rows?.length || 0, target });
    } catch (error) {
      console.error("push send setup error:", error?.message || error);
      return json(res, 500, { error: error?.message || "Non è stato possibile inviare le notifiche." });
    }
  }

  if (action === "schedule") {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });
    try {
      const title = String(req.body?.title || "").trim().slice(0, 80);
      const body = String(req.body?.body || "").trim().slice(0, 180);
      const target = req.body?.target === "nickname" ? "nickname" : "all";
      const nickname = String(req.body?.nickname || "").trim().slice(0, 40) || null;
      const scheduledAt = new Date(req.body?.scheduledAt);
      if (!title || !body || !Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date()) return json(res, 400, { error: "Inserisci titolo, messaggio e un orario futuro valido." });
      if (target === "nickname" && !nickname) return json(res, 400, { error: "Inserisci il soprannome del destinatario." });
      const supabase = supabaseAdmin();
      const { data, error } = await supabase.from("scheduled_notifications").insert({ title, body, target, nickname, scheduled_at: scheduledAt.toISOString(), status: "pending" }).select("id, scheduled_at").single();
      if (error) throw error;
      return json(res, 201, { ok: true, notification: data });
    } catch (error) {
      console.error("push schedule error:", error?.message || error);
      return json(res, 500, { error: "Impossibile programmare la notifica. Verifica la migrazione SQL delle notifiche personalizzate." });
    }
  }
  if (action === "cron") {
    if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
    const secret = process.env.CRON_SECRET;
    const authorization = req.headers.authorization || "";
    if (!secret || authorization !== `Bearer ${secret}`) return json(res, 401, { error: "Accesso cron non autorizzato." });
    try {
      setupWebPush();
      const supabase = supabaseAdmin();
      const { data: due, error } = await supabase.from("scheduled_notifications").select("*").eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(20);
      if (error) throw error;
      let processed = 0;
      for (const item of due || []) {
        // Mark as processing first to reduce the chance of duplicate sends on overlapping cron runs.
        const { data: claimed, error: claimError } = await supabase.from("scheduled_notifications").update({ status: "processing" }).eq("id", item.id).eq("status", "pending").select("id").maybeSingle();
        if (claimError || !claimed) continue;
        let query = supabase.from("push_subscriptions").select("endpoint, subscription, nickname");
        if (item.target === "nickname") query = query.ilike("nickname", item.nickname || "");
        const { data: rows, error: rowsError } = await query;
        if (rowsError) { await supabase.from("scheduled_notifications").update({ status: "failed", error_message: rowsError.message }).eq("id", item.id); continue; }
        let sent = 0;
        for (const row of rows || []) {
          try { await webpush.sendNotification(row.subscription, JSON.stringify({ title: item.title, body: item.body, url: "/" }), { TTL: 3600 }); sent++; }
          catch (sendError) {
            if (sendError?.statusCode === 404 || sendError?.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
            console.error("scheduled push send error:", sendError?.statusCode || "unknown", sendError?.message || sendError);
          }
        }
        await supabase.from("scheduled_notifications").update({ status: "sent", sent_count: sent, sent_at: new Date().toISOString() }).eq("id", item.id);
        processed++;
      }
      return json(res, 200, { ok: true, processed });
    } catch (error) {
      console.error("push cron error:", error?.message || error);
      return json(res, 500, { error: "Errore durante l'invio delle notifiche programmate." });
    }
  }

  return json(res, 404, { error: "Azione notifiche non riconosciuta." });
}
