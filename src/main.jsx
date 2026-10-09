import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Camera, ImagePlus, Heart, ShieldCheck, Check, X, Download, LockKeyhole, QrCode, RefreshCw, Sparkles, Images, UploadCloud } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./styles.css";

const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
const ADMIN_MODE = new URLSearchParams(window.location.search).get("admin") === "1";

function App() {
  const [photos, setPhotos] = useState([]);
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  async function loadGallery() {
    try {
      const response = await fetch("/api/gallery");
      const data = await response.json();
      if (response.ok) setPhotos(data.photos || []);
    } catch { /* network can be temporarily unavailable */ }
  }
  async function loadPending(password = adminPassword) {
    const response = await fetch("/api/admin/photos", { headers: { "x-admin-password": password } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Non riesco a caricare le foto in revisione.");
    setPending(data.photos || []);
    setAuthenticated(true);
  }
  useEffect(() => {
    loadGallery();
    const timer = setInterval(loadGallery, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (ADMIN_MODE && authenticated) loadPending().catch(e => setNotice(e.message)); }, [authenticated]);

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const accepted = files.filter(f => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
    if (!accepted.length) {
      setNotice("Scegli immagini valide fino a 12 MB ciascuna.");
      return;
    }
    if (accepted.length !== files.length) setNotice("Alcuni file sono stati ignorati: sono ammessi solo immagini fino a 12 MB.");
    setBusy(true);
    let success = 0;
    for (const file of accepted) {
      try {
        const form = new FormData();
        form.append("photo", file);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Caricamento non riuscito.");
        success++;
      } catch (e) {
        setNotice(e.message || "Errore durante il caricamento.");
      }
    }
    setBusy(false);
    if (success) setNotice(success === 1 ? "Foto inviata! Comparirà nell'album dopo l'approvazione." : `${success} foto inviate! Compariranno nell'album dopo l'approvazione.`);
  }

  async function moderate(id, action) {
    setAdminBusy(true);
    try {
      const response = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
      await loadPending();
      await loadGallery();
      setNotice(action === "approve" ? "Foto approvata e pubblicata." : "Foto rifiutata.");
    } catch (e) { setNotice(e.message); }
    finally { setAdminBusy(false); }
  }

  if (ADMIN_MODE) {
    return <main className="admin-shell">
      <header className="admin-top"><a className="brand" href="/"><span className="brand-mark">C</span><span>LAUREA DI <b>CARMINE</b></span></a><span className="admin-label"><LockKeyhole size={15}/> Area organizzatore</span></header>
      <section className="admin-card">
        <span className="eyebrow">AREA RISERVATA</span><h1>Approva i ricordi</h1><p className="muted">Le foto inviate dagli invitati restano private finché non le approvi.</p>
        {!authenticated ? <form onSubmit={async e => { e.preventDefault(); try { await loadPending(); setNotice(""); } catch (err) { setNotice(err.message); } }}>
          <label htmlFor="adminPassword">Password organizzatore</label>
          <input id="adminPassword" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} autoComplete="current-password" required placeholder="Inserisci la password" />
          <button className="primary full" type="submit"><LockKeyhole size={18}/> Accedi alle approvazioni</button>
        </form> : <>
          <div className="pending-head"><b>{pending.length} {pending.length === 1 ? "foto in attesa" : "foto in attesa"}</b><button className="icon-button" onClick={() => loadPending().catch(e => setNotice(e.message))} aria-label="Aggiorna"><RefreshCw size={17}/></button></div>
          {pending.length === 0 ? <div className="empty"><ShieldCheck size={32}/><b>Tutto aggiornato</b><span>Non ci sono foto da approvare.</span></div> :
            <div className="pending-grid">{pending.map(p => <article className="pending-item" key={p.id}>
              <img src={p.url} alt="Foto in attesa di approvazione"/>
              <div className="pending-actions"><button className="approve" disabled={adminBusy} onClick={() => moderate(p.id, "approve")}><Check size={16}/> Approva</button><button className="reject" disabled={adminBusy} onClick={() => moderate(p.id, "reject")}><X size={16}/> Rifiuta</button></div>
            </article>)}</div>}
          <button className="secondary full logout" onClick={() => { setAuthenticated(false); setPending([]); setAdminPassword(""); }}>Esci dall'area organizzatore</button>
        </>}
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>
      <footer>Le foto approvate diventano visibili nell'album condiviso.</footer>
    </main>;
  }

  return <main>
    <nav className="topbar"><a className="brand" href="#"><span className="brand-mark">C</span><span>LAUREA DI <b>CARMINE</b></span></a><a className="nav-link" href="#album"><Images size={16}/> Album</a></nav>
    <section className="hero">
      <div className="hero-glow"></div><div className="laurel">✳</div>
      <span className="eyebrow"><Sparkles size={14}/> UNA GIORNATA DA RICORDARE</span>
      <h1>Laurea di <em>Carmine</em></h1>
      <p className="hero-subtitle">Una serata, mille ricordi.</p>
      <div className="hero-rule"><span></span><Heart size={15} fill="currentColor"/><span></span></div>
      <p className="hero-copy">Scatta, condividi e rivivi i momenti più belli.<br/>Carica qui le tue foto: dopo una rapida approvazione, saranno visibili a tutti.</p>
      <label className={`upload-button ${busy ? "is-busy" : ""}`}>
        {busy ? <RefreshCw className="spin" size={20}/> : <Camera size={20}/>}
        <span>{busy ? "Caricamento in corso…" : "Condividi le tue foto"}</span>
        <input type="file" accept="image/*" multiple capture="environment" disabled={busy} onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }}/>
      </label>
      <p className="upload-hint"><LockKeyhole size={13}/> Le foto vengono pubblicate solo dopo approvazione.</p>
      {notice && <div className="notice hero-notice" role="status">{notice}</div>}
      <a href="#album" className="scroll-link">SCOPRI L'ALBUM <span>↓</span></a>
    </section>

    <section className="album-section" id="album">
      <div className="section-heading"><div><span className="eyebrow">I NOSTRI RICORDI</span><h2>La galleria condivisa</h2><p className="muted">I momenti più belli, raccolti in un unico posto.</p></div><span className="photo-count">{photos.length} {photos.length === 1 ? "foto" : "foto"}</span></div>
      {photos.length ? <div className="photo-grid">{photos.map((photo, i) => <button className="photo-tile" key={photo.id} onClick={() => setSelected(photo)} aria-label={`Apri foto ${i+1}`}><img src={photo.url} alt={`Ricordo della laurea di Carmine ${i+1}`} loading="lazy"/><span className="photo-overlay"><Heart size={18}/></span></button>)}</div> :
        <div className="empty-gallery"><div className="empty-icon"><Images size={30}/></div><h3>Il primo ricordo può essere il tuo</h3><p>Le foto approvate dagli organizzatori appariranno qui durante la festa.</p><button className="text-button" onClick={() => window.scrollTo({top: 0, behavior: "smooth"})}>Carica la prima foto <span>↑</span></button></div>}
      <div className="gallery-refresh"><span><span className="live-dot"></span> Album aggiornato automaticamente</span><button onClick={loadGallery}><RefreshCw size={14}/> Aggiorna</button></div>
    </section>

    <section className="share-section"><div className="share-card"><div><span className="eyebrow">INVITA I TUOI RICORDI</span><h2>Condividi il momento.</h2><p>Inquadra il QR code per aprire l'album da un altro telefono.</p></div><div className="qr-frame"><QRCodeSVG value={APP_URL} size={130} bgColor="#fffaf3" fgColor="#651d32" level="M" includeMargin/></div></div></section>
    <footer className="footer"><span className="footer-mark">C</span><p>Fatto con <Heart size={13} fill="currentColor"/> per Carmine</p><span className="footer-small">UN RICORDO DA CONSERVARE</span></footer>
    {selected && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><button className="close-lightbox" aria-label="Chiudi" onClick={() => setSelected(null)}><X/></button><img src={selected.url} alt="Foto della laurea" onClick={e => e.stopPropagation()}/><a className="download-photo" href={selected.url} download><Download size={16}/> Scarica foto</a></div>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
