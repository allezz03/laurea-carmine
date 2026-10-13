import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../../api/_supabase.js";
import { hashPassword, validEvent } from "../../api/_album-auth.js";
export default async function handler(req, res) {
 if (!checkAdmin(req)) return json(res, 401, {error:"Password organizzatore non valida."});
 if (req.method === "GET") {
  try { const {data,error}=await supabaseAdmin().from("album_passwords").select("event,updated_at"); if(error) throw error; return json(res,200,{configured:Object.fromEntries(["Cena","Festa","Proclamazione"].map(e=>[e,(data||[]).some(r=>r.event===e)]))}); }
  catch(e){ console.error("password status error:",e?.message||e); return json(res,500,{error:"Non riesco a leggere lo stato delle password."}); }
 }
 if (req.method !== "POST") return methodNotAllowed(res,["GET","POST"]);
 const {event,password}=req.body||{};
 if(!validEvent(event)||typeof password!=="string"||password.length<6||password.length>100) return json(res,400,{error:"Scegli un evento e una password di almeno 6 caratteri (massimo 100)."});
 try { const {salt,hash}=hashPassword(password); const {error}=await supabaseAdmin().from("album_passwords").upsert({event,salt,password_hash:hash,updated_at:new Date().toISOString()},{onConflict:"event"}); if(error) throw error; return json(res,200,{ok:true,event}); }
 catch(e){console.error("password update error:",e?.message||e);return json(res,500,{error:"Non è stato possibile salvare la password."});}
}
