import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Camera, ImagePlus, Heart, ShieldCheck, Check, X, Download, Share, LockKeyhole, QrCode, RefreshCw, Sparkles, Images, UploadCloud, Trash2, ArrowLeft, Utensils, PartyPopper, Video, Play } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./styles.css";

const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
const ADMIN_MODE = window.location.pathname.replace(/\/$/, "") === "/organizzatore" || new URLSearchParams(window.location.search).get("admin") === "1";

function App() {
  const [photos, setPhotos] = useState([]);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState([]);
  const initialEvent = new URLSearchParams(window.location.search).get("evento");
  const [selectedEvent, setSelectedEvent] = useState(["Cena", "Festa"].includes(initialEvent) ? initialEvent : null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showQrZoom, setShowQrZoom] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [preparedFiles, setPreparedFiles] = useState([]);
  const [preparedPhotoIds, setPreparedPhotoIds] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [videoDraft, setVideoDraft] = useState(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);

  async function loadGallery(eventName = selectedEvent) {
    if (!eventName) { setPhotos([]); return; }
    try {
      const response = await fetch(`/api/gallery?event=${encodeURIComponent(eventName)}`);
      const data = await response.json();
      if (response.ok) setPhotos(data.photos || []);
    } catch { /* network can be temporarily unavailable */ }
  }
  async function savePhotoToDevice(photo) {
    const fileName = `laurea-carmine-${(photo.event || selectedEvent || "foto").toLowerCase()}-${photo.id}.jpg`;
    const downloadUrl = `/api/download?id=${encodeURIComponent(photo.id)}`;
    try {
      // On iPhone/iPad and supported Android browsers, share the actual image file.
      // The native share sheet lets the guest choose "Save Image" / "Save to Photos".
      if (navigator.share && navigator.canShare && typeof File !== "undefined") {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Non riesco a preparare la foto. Riprova.");
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Laurea di Carmine", text: "Un ricordo della laurea di Carmine" });
          return;
        }
      }
      // Fallback for browsers that do not support sharing files.
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      if (error?.name === "AbortError") return; // User closed the share sheet.
      setNotice(error?.message || "Non è stato possibile preparare la foto.");
      // If native sharing failed for a reason other than cancellation, still offer download.
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  function togglePhotoSelection(photo) {
    setPreparedFiles([]);
    setPreparedPhotoIds([]);
    setSelectedPhotoIds(current => current.includes(photo.id)
      ? current.filter(id => id !== photo.id)
      : [...current, photo.id]);
  }

  async function downloadSelectedPhotos() {
    // If the files are already prepared, call navigator.share immediately from
    // this click handler. Awaiting a fetch first would lose the browser's user gesture.
    if (preparedFiles.length) {
      try {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: preparedFiles })) {
          const sharePromise = navigator.share({ files: preparedFiles, title: "Laurea di Carmine", text: "Foto della laurea di Carmine" });
          await sharePromise;
          const completed = new Set(preparedPhotoIds);
          const remainingIds = selectedPhotoIds.filter(id => !completed.has(id));
          setSelectedPhotoIds(remainingIds);
          setPreparedFiles([]);
          setPreparedPhotoIds([]);
          if (remainingIds.length) {
            setNotice(`Gruppo condiviso. Restano ${remainingIds.length} foto: premi “Prepara foto selezionate” per continuare.`);
          } else {
            setNotice("Scegli “Salva immagini” nel menu di condivisione per salvarle in Foto.");
            setSelectionMode(false);
          }
        } else {
          setNotice("La condivisione di più immagini non è supportata da questo browser. Prova con Safari aggiornato.");
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        setNotice(error?.message || "Non è stato possibile aprire la condivisione. Riprova.");
      }
      return;
    }

    const chosen = photos.filter(photo => photo.media_type !== "video" && selectedPhotoIds.includes(photo.id));
    if (!chosen.length) {
      setNotice("Seleziona almeno una foto da salvare.");
      return;
    }

    // Prepare up to three files asynchronously first. Sharing is a separate tap,
    // so navigator.share can be called directly during the next user gesture.
    const batch = chosen.slice(0, 3);
    setBulkBusy(true);
    try {
      const files = [];
      for (let i = 0; i < batch.length; i++) {
        const photo = batch[i];
        setNotice(`Preparo la foto ${i + 1} di ${batch.length}…`);
        const response = await fetch(`/api/download?id=${encodeURIComponent(photo.id)}`);
        if (!response.ok) throw new Error(`Non è stato possibile preparare la foto ${i + 1}.`);
        const blob = await response.blob();
        const mime = blob.type || "image/jpeg";
        const subtype = (mime.split("/")[1] || "jpeg").split(";")[0];
        const extension = subtype === "jpeg" ? "jpg" : subtype;
        files.push(new File([blob], `laurea-carmine-${(photo.event || selectedEvent || "foto").toLowerCase()}-${photo.id}.${extension}`, { type: mime }));
      }
      if (navigator.share && navigator.canShare && navigator.canShare({ files })) {
        setPreparedFiles(files);
        setPreparedPhotoIds(batch.map(photo => photo.id));
        setNotice(`Pronte ${files.length} foto. Premi di nuovo il pulsante per aprire la condivisione e salvarle in Foto.`);
      } else {
        // Fallback for browsers without native file sharing.
        for (const file of files) {
          const url = URL.createObjectURL(file);
          const link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        const completed = new Set(batch.map(photo => photo.id));
        const remainingIds = selectedPhotoIds.filter(id => !completed.has(id));
        setSelectedPhotoIds(remainingIds);
        setNotice(remainingIds.length ? `Download avviato. Restano ${remainingIds.length} foto.` : "Download delle foto avviato.");
        if (!remainingIds.length) setSelectionMode(false);
      }
    } catch (error) {
      setNotice(error?.message || "Non è stato possibile preparare le foto selezionate. Riprova.");
    } finally {
      setBulkBusy(false);
    }
  }

  function chooseVideo(fileList) {
    const file = Array.from(fileList || [])[0];
    if (!file) return;
    const allowed = ["video/mp4", "video/quicktime", "video/webm"];
    if (!allowed.includes(file.type)) { setNotice("Formato non supportato. Scegli un video MP4, MOV o WebM."); return; }
    if (file.size > 50 * 1024 * 1024) { setNotice("Il video deve pesare al massimo 50 MB."); return; }
    const preview = document.createElement("video");
    preview.preload = "metadata";
    preview.onloadedmetadata = () => {
      URL.revokeObjectURL(preview.src);
      if (!Number.isFinite(preview.duration) || preview.duration > 180) {
        setNotice("Il video deve durare al massimo 3 minuti.");
        return;
      }
      setVideoDraft({ file, previewUrl: URL.createObjectURL(file), duration: preview.duration });
      setVideoCaption("");
    };
    preview.onerror = () => { URL.revokeObjectURL(preview.src); setNotice("Non riesco a leggere questo video. Prova con un file MP4 o MOV."); };
    preview.src = URL.createObjectURL(file);
  }

  function closeVideoDraft() {
    if (videoDraft?.previewUrl) URL.revokeObjectURL(videoDraft.previewUrl);
    setVideoDraft(null);
    setVideoCaption("");
  }

  async function submitVideo() {
    if (!videoDraft || videoBusy) return;
    setVideoBusy(true);
    try {
      setNotice("Preparo il caricamento sicuro del video…");
      const request = await fetch("/api/video-upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: selectedEvent || "Festa", mimeType: videoDraft.file.type, size: videoDraft.file.size, caption: videoCaption })
      });
      const uploadInfo = await request.json();
      if (!request.ok) throw new Error(uploadInfo.error || "Non è stato possibile preparare il video.");
      setNotice("Caricamento video in corso… non chiudere la pagina.");
      const uploaded = await fetch(uploadInfo.signedUrl, { method: "PUT", headers: { "Content-Type": videoDraft.file.type, "x-upsert": "false" }, body: videoDraft.file });
      if (!uploaded.ok) {
        const detail = await uploaded.text().catch(() => "");
        throw new Error(detail.includes("Payload Too Large") ? "Il video supera il limite consentito da Supabase Storage." : "Caricamento del video non riuscito. Controlla la connessione e riprova.");
      }
      const completed = await fetch("/api/video-upload-complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uploadInfo.id, path: uploadInfo.path, event: uploadInfo.event, mimeType: uploadInfo.mimeType, size: uploadInfo.size, caption: uploadInfo.caption })
      });
      const result = await completed.json();
      if (!completed.ok) throw new Error(result.error || "Video caricato ma non registrato. Contatta l'organizzatore.");
      closeVideoDraft();
      setNotice(result.status === "approved" ? "Video caricato e pubblicato nell'album!" : "Video inviato! Comparirà nell'album dopo l'approvazione.");
      await loadGallery();
    } catch (error) {
      setNotice(error?.message || "Non è stato possibile caricare il video.");
    } finally { setVideoBusy(false); }
  }

  async function loadPending(password = adminPassword) {
    const response = await fetch("/api/admin/photos", { headers: { "x-admin-password": password } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Non riesco a caricare le foto in revisione.");
    setPending(data.pending || (data.photos || []).filter(p => p.status === "pending"));
    setApproved(data.approved || (data.photos || []).filter(p => p.status === "approved"));
    const reviewResponse = await fetch("/api/admin/review", { headers: { "x-admin-password": password } });
    const reviewData = await reviewResponse.json();
    if (!reviewResponse.ok) throw new Error(reviewData.error || "Non riesco a leggere l'impostazione di revisione.");
    setReviewEnabled(reviewData.reviewEnabled !== false);
    setAuthenticated(true);
  }
  useEffect(() => {
    fetch("/api/review-status").then(r => r.json()).then(data => setReviewEnabled(data.reviewEnabled !== false)).catch(() => {});
  }, []);
  useEffect(() => {
    if (selectedEvent) loadGallery(selectedEvent);
    const timer = setInterval(() => { if (selectedEvent) loadGallery(selectedEvent); }, 15000);
    return () => clearInterval(timer);
  }, [selectedEvent]);
  useEffect(() => { if (ADMIN_MODE && authenticated) loadPending().catch(e => setNotice(e.message)); }, [authenticated]);

  function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const accepted = files.filter(f => f.type.startsWith("image/") && f.size <= 12 * 1024 * 1024);
    if (!accepted.length) {
      setNotice("Scegli immagini valide fino a 12 MB ciascuna.");
      return;
    }
    if (accepted.length !== files.length) setNotice("Alcuni file sono stati ignorati: sono ammessi solo immagini fino a 12 MB.");
    setUploadQueue(accepted.map(file => ({ file, caption: "", preview: URL.createObjectURL(file) })));
  }

  function updateUploadCaption(index, caption) {
    setUploadQueue(current => current.map((item, i) => i === index ? { ...item, caption } : item));
  }

  function closeUploadQueue() {
    uploadQueue.forEach(item => URL.revokeObjectURL(item.preview));
    setUploadQueue([]);
  }

  async function submitUploadQueue() {
    if (!uploadQueue.length) return;
    setBusy(true);
    let success = 0;
    let publishedImmediately = 0;
    const queue = [...uploadQueue];
    for (const [index, item] of queue.entries()) {
      try {
        setNotice(`Carico la foto ${index + 1} di ${queue.length}…`);
        const form = new FormData();
        form.append("event", selectedEvent || "Festa");
        form.append("caption", item.caption.trim().slice(0, 180));
        form.append("photo", item.file);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Caricamento non riuscito.");
        success++;
        if (data.status === "approved") publishedImmediately++;
      } catch (e) {
        setNotice(e.message || "Errore durante il caricamento.");
      }
    }
    queue.forEach(item => URL.revokeObjectURL(item.preview));
    setUploadQueue([]);
    setBusy(false);
    if (success) {
      if (publishedImmediately === success) setNotice(success === 1 ? "Foto caricata e pubblicata nell'album!" : `${success} foto caricate e pubblicate nell'album!`);
      else if (publishedImmediately > 0) setNotice(`${success - publishedImmediately} foto inviate in revisione e ${publishedImmediately} pubblicate subito.`);
      else setNotice(success === 1 ? "Foto inviata! Comparirà nell'album dopo l'approvazione." : `${success} foto inviate! Compariranno nell'album dopo l'approvazione.`);
      await loadGallery();
    }
  }

  async function toggleReview() {
    const nextValue = !reviewEnabled;
    if (!nextValue && !window.confirm("Disattivare la revisione? Tutte le foto attualmente in attesa verranno approvate e pubblicate automaticamente.")) return;
    setAdminBusy(true);
    try {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ reviewEnabled: nextValue })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Non è stato possibile modificare la revisione.");
      setReviewEnabled(data.reviewEnabled);
      await loadPending();
      await loadGallery();
      setNotice(nextValue
        ? "Revisione attivata: le nuove foto dovranno essere approvate."
        : `Revisione disattivata: le nuove foto saranno pubblicate subito${data.automaticallyApproved ? ` e ${data.automaticallyApproved} foto in attesa sono state approvate automaticamente` : "; non c'erano foto in attesa"}.`);
    } catch (e) { setNotice(e.message); }
    finally { setAdminBusy(false); }
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
      setNotice(action === "approve" ? "Foto approvata e pubblicata." : action === "delete" ? "Foto eliminata definitivamente." : "Foto rifiutata.");
    } catch (e) { setNotice(e.message); }
    finally { setAdminBusy(false); }
  }

  function toggleDeleteSelection(id) {
    setSelectedDeleteIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function toggleSelectAllApproved() {
    setSelectedDeleteIds(current => approved.length > 0 && approved.every(photo => current.includes(photo.id))
      ? current.filter(id => !approved.some(photo => photo.id === id))
      : [...new Set([...current, ...approved.map(photo => photo.id)])]);
  }

  async function deleteSelectedPhotos() {
    const ids = selectedDeleteIds.filter(id => approved.some(photo => photo.id === id));
    if (!ids.length) return;
    if (!window.confirm(`Vuoi eliminare definitivamente ${ids.length} ${ids.length === 1 ? "foto" : "foto"}? Questa operazione non può essere annullata.`)) return;
    setAdminBusy(true);
    try {
      const response = await fetch("/api/admin/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ ids })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Non è stato possibile eliminare le foto selezionate.");
      setSelectedDeleteIds(current => current.filter(id => !ids.includes(id)));
      await loadPending();
      await loadGallery();
      setNotice(`${data.deleted ?? ids.length} ${data.deleted === 1 ? "foto eliminata" : "foto eliminate"} definitivamente.`);
    } catch (e) { setNotice(e.message || "Errore durante l'eliminazione multipla."); }
    finally { setAdminBusy(false); }
  }

  if (ADMIN_MODE) {
    return <main className="admin-shell">
      <header className="admin-top"><a className="brand" href="/"><span className="brand-mark">C</span><span>LAUREA DI <b>CARMINE</b></span></a><span className="admin-label"><LockKeyhole size={15}/> Area organizzatore</span></header>
      <section className="admin-card">
        <span className="eyebrow">AREA RISERVATA</span><h1>Approva i ricordi</h1><p className="muted">Foto e video inviati dagli invitati restano privati finché non li approvi.</p>
        {!authenticated ? <form onSubmit={async e => { e.preventDefault(); try { await loadPending(); setNotice(""); } catch (err) { setNotice(err.message); } }}>
          <label htmlFor="adminPassword">Password organizzatore</label>
          <input id="adminPassword" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} autoComplete="current-password" required placeholder="Inserisci la password" />
          <button className="primary full" type="submit"><LockKeyhole size={18}/> Accedi alle approvazioni</button>
        </form> : <>
          <div className={`review-setting ${reviewEnabled ? "review-on" : "review-off"}`}>
            <div><b>Revisione foto: {reviewEnabled ? "ATTIVA" : "DISATTIVATA"}</b><span>{reviewEnabled ? "Le nuove foto aspettano la tua approvazione." : "Le nuove foto vengono pubblicate subito."}</span></div>
            <button className={reviewEnabled ? "secondary" : "primary"} disabled={adminBusy} onClick={toggleReview}>{reviewEnabled ? "Disattiva revisione" : "Attiva revisione"}</button>
          </div>
          <div className="pending-head"><b>{pending.length} foto in attesa di approvazione</b><button className="icon-button" onClick={() => loadPending().catch(e => setNotice(e.message))} aria-label="Aggiorna"><RefreshCw size={17}/></button></div>
          {pending.length === 0 ? <div className="empty"><ShieldCheck size={32}/><b>Tutto aggiornato</b><span>Non ci sono contenuti da approvare.</span></div> :
            <div className="pending-grid">{pending.map(p => <article className="pending-item" key={p.id}>
              {p.media_type === "video" ? <video src={p.url} controls playsInline preload="metadata" aria-label="Video in attesa di approvazione"/> : <img src={p.url} alt="Foto in attesa di approvazione"/>}
              <div className="photo-event-tag">{p.event}</div>
              <div className="pending-actions"><button className="approve" disabled={adminBusy} onClick={() => moderate(p.id, "approve")}><Check size={16}/> Approva</button><button className="reject" disabled={adminBusy} onClick={() => moderate(p.id, "reject")}><X size={16}/> Rifiuta</button></div>
            </article>)}</div>}
          <div className="pending-head published-head"><b>Contenuti già pubblicati ({approved.length})</b></div>
          <p className="muted admin-help">Seleziona una o più foto o video per eliminarli insieme dall'album condiviso.</p>
          {approved.length === 0 ? <div className="empty"><Images size={30}/><b>Nessuna foto pubblicata</b><span>Le foto approvate compariranno qui.</span></div> : <>
            <div className="bulk-delete-toolbar">
              <button className="secondary" disabled={adminBusy} onClick={toggleSelectAllApproved}>{approved.length > 0 && approved.every(photo => selectedDeleteIds.includes(photo.id)) ? "Deseleziona tutte" : "Seleziona tutto"}</button>
              <span>{selectedDeleteIds.filter(id => approved.some(photo => photo.id === id)).length} selezionate</span>
              <button className="reject" disabled={adminBusy || !selectedDeleteIds.some(id => approved.some(photo => photo.id === id))} onClick={deleteSelectedPhotos}><Trash2 size={16}/> Elimina selezionate</button>
            </div>
            <div className="pending-grid">{approved.map(p => {
              const isChosen = selectedDeleteIds.includes(p.id);
              return <article className={`pending-item ${isChosen ? "pending-item-selected" : ""}`} key={p.id}>
                <button type="button" className={`admin-photo-select ${isChosen ? "is-selected" : ""}`} aria-pressed={isChosen} aria-label={isChosen ? "Deseleziona foto" : "Seleziona foto"} onClick={() => toggleDeleteSelection(p.id)} disabled={adminBusy}>
                  {p.media_type === "video" ? <video src={p.url} muted playsInline preload="metadata"/> : <img src={p.url} alt="Foto già pubblicata"/>}<span className="admin-photo-check">{isChosen ? "✓" : ""}</span>
                </button>
                <div className="photo-event-tag">{p.event}</div>
                <div className="pending-actions"><button className="reject delete-photo" disabled={adminBusy} onClick={() => { if (window.confirm("Vuoi eliminare definitivamente questa foto?")) moderate(p.id, "delete"); }}><Trash2 size={16}/> Elimina</button></div>
              </article>;
            })}</div>
          </>}
          <button className="secondary full logout" onClick={() => { setAuthenticated(false); setPending([]); setApproved([]); setAdminPassword(""); }}>Esci dall'area organizzatore</button>
        </>}
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>
      <footer>I contenuti approvati diventano visibili nell'album condiviso.</footer>
    </main>;
  }

  if (!selectedEvent) {
    return <main className="event-picker-page">
      <nav className="topbar event-picker-topbar"><a className="brand" href="/"><span className="brand-mark">C</span><span>LAUREA DI <b>CARMINE</b></span></a><a className="nav-link organizer-top-link" href="/organizzatore"><LockKeyhole size={15}/> Area organizzatore</a></nav>
      <section className="event-picker">
        <div className="laurel">✳</div>
        <span className="eyebrow"><Sparkles size={14}/> UNA GIORNATA DA RICORDARE</span>
        <h1>Laurea di <em>Carmine</em></h1>
        <p className="hero-subtitle">Scegli l'album da esplorare</p>
        <div className="event-choice-grid">
          <button className="event-choice" onClick={() => { setSelectedEvent("Cena"); window.history.replaceState({}, "", `${window.location.pathname}?evento=Cena`); }}><span className="event-choice-icon"><Utensils size={27}/></span><strong>Cena</strong><small>Foto e ricordi della cena</small><span className="event-choice-arrow">Apri album →</span></button>
          <button className="event-choice" onClick={() => { setSelectedEvent("Festa"); window.history.replaceState({}, "", `${window.location.pathname}?evento=Festa`); }}><span className="event-choice-icon"><PartyPopper size={27}/></span><strong>Festa</strong><small>Foto e ricordi della festa</small><span className="event-choice-arrow">Apri album →</span></button>
        </div>
        <p className="event-picker-note"><LockKeyhole size={13}/> {reviewEnabled ? "Le foto vengono pubblicate solo dopo approvazione." : "Le foto vengono pubblicate subito."}</p>
      </section>
      <footer className="footer"><span className="footer-mark">C</span><p>Fatto con <Heart size={13} fill="currentColor"/> per Carmine</p><a className="organizer-link" href="/organizzatore"><LockKeyhole size={13}/> Area organizzatore</a><span className="footer-small">UN RICORDO DA CONSERVARE</span></footer>
    </main>;
  }

  return <main>
    <nav className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setSelectedEvent(null); window.history.replaceState({}, "", window.location.pathname); }}><span className="brand-mark">C</span><span>LAUREA DI <b>CARMINE</b></span></a><div className="topbar-right"><a className="nav-link organizer-top-link" href="/organizzatore"><LockKeyhole size={15}/> Area organizzatore</a><span className="active-event-pill">Album {selectedEvent}</span><button className="nav-link change-event" onClick={() => { setSelectedEvent(null); window.history.replaceState({}, "", window.location.pathname); }}><ArrowLeft size={15}/> Cambia album</button></div></nav>

    <section className="hero">
      <div className="hero-glow"></div><div className="laurel">✳</div>
      <span className="eyebrow"><Sparkles size={14}/> UNA GIORNATA DA RICORDARE</span>
      <h1>Laurea di <em>Carmine</em></h1>
      <p className="hero-subtitle">Album {selectedEvent} · Una serata, mille ricordi.</p>
      <div className="hero-rule"><span></span><Heart size={15} fill="currentColor"/><span></span></div>
      <p className="hero-copy">Scatta, condividi e rivivi i momenti più belli.<br/>{reviewEnabled ? "Carica qui le tue foto: dopo una rapida approvazione, saranno visibili a tutti." : "Carica qui le tue foto: verranno pubblicate subito nell'album condiviso."}</p>
      <div className="upload-options">
        <label className={`upload-button ${busy ? "is-busy" : ""}`}>
          {busy ? <RefreshCw className="spin" size={20}/> : <Camera size={20}/>}
          <span>{busy ? "Caricamento in corso…" : "Scatta una foto"}</span>
          <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }}/>
        </label>
        <label className={`upload-button upload-button-secondary ${busy ? "is-busy" : ""}`}>
          <Images size={20}/>
          <span>Scegli dalla galleria</span>
          <input type="file" accept="image/*" multiple disabled={busy} onChange={e => { uploadFiles(e.target.files); e.target.value = ""; }}/>
        </label>
        <label className={`upload-button ${videoBusy ? "is-busy" : ""}`}>
          <Video size={20}/><span>Carica un video</span>
          <input type="file" accept="video/mp4,video/quicktime,video/webm" capture="environment" disabled={busy || videoBusy} onChange={e => { chooseVideo(e.target.files); e.target.value = ""; }}/>
        </label>
      </div>
      <p className="upload-hint"><Camera size={13}/> Scatta una nuova foto, seleziona immagini dalla galleria oppure aggiungi un video fino a 3 minuti.</p><p className="upload-hint"><LockKeyhole size={13}/> {reviewEnabled ? "Le foto vengono pubblicate solo dopo approvazione." : "La revisione è disattivata: le foto saranno pubblicate subito."}</p>
      {notice && <div className="notice hero-notice" role="status">{notice}</div>}
      <a href="#album" className="scroll-link">SCOPRI L'ALBUM <span>↓</span></a>
    </section>

    <section className="album-section" id="album">
      <div className="section-heading"><div><span className="eyebrow">I NOSTRI RICORDI</span><h2>La galleria condivisa</h2><p className="muted">I momenti più belli, raccolti in un unico posto.</p></div><span className="photo-count">{photos.length} {photos.length === 1 ? "foto" : "foto"}</span></div>
      {photos.length ? <>
        <div className="bulk-toolbar">
          {!selectionMode ? <button className="secondary" onClick={() => { setSelectionMode(true); setSelectedPhotoIds([]); }}><Check size={16}/> Seleziona foto da scaricare</button> : <>
            <span>{selectedPhotoIds.length} selezionate</span>
            <button className="secondary" onClick={() => setSelectedPhotoIds(photos.filter(p => p.media_type !== "video").map(p => p.id))}>Seleziona tutte</button>
            <button className="primary" disabled={bulkBusy || selectedPhotoIds.length === 0} onClick={downloadSelectedPhotos}><Download size={16}/>{bulkBusy ? "Preparo…" : preparedFiles.length ? `Condividi ${preparedFiles.length} foto` : "Prepara foto selezionate"}</button>
            <button className="text-button" onClick={() => { setSelectionMode(false); setSelectedPhotoIds([]); }}>Annulla</button>
          </>}
        </div>
        <div className="photo-grid">{photos.map((photo, i) => <button className={`photo-tile ${selectionMode && selectedPhotoIds.includes(photo.id) ? "is-selected" : ""}`} key={photo.id} onClick={() => selectionMode ? (photo.media_type === "video" ? setNotice("Il download multiplo è disponibile per le foto; i video si possono aprire e scaricare singolarmente.") : togglePhotoSelection(photo)) : setSelected(photo)} aria-label={selectionMode ? `Seleziona contenuto ${i+1}` : `Apri contenuto ${i+1}`}>
          <span className={`polaroid-image ${photo.media_type === "video" ? "video-thumb" : ""}`}>{photo.media_type === "video" ? <><video src={photo.url} preload="metadata" muted playsInline/><span className="video-play"><Play size={28} fill="currentColor"/></span></> : <img src={photo.url} alt={`Ricordo della laurea di Carmine ${i+1}`} loading="lazy"/>}
          {selectionMode ? <span className="selection-mark">{selectedPhotoIds.includes(photo.id) ? <Check size={19}/> : null}</span> : <span className="photo-overlay"><Heart size={18}/></span>}</span>
          <span className={`polaroid-caption ${photo.caption ? "has-caption" : ""}`}>{photo.caption || "Un ricordo da conservare"}</span>
        </button>)}</div>
      </> :
        <div className="empty-gallery"><div className="empty-icon"><Images size={30}/></div><h3>Il primo ricordo può essere il tuo</h3><p>Le foto approvate dagli organizzatori appariranno qui durante la festa.</p><button className="text-button" onClick={() => window.scrollTo({top: 0, behavior: "smooth"})}>Carica la prima foto <span>↑</span></button></div>}
      <div className="gallery-refresh"><span><span className="live-dot"></span> Album aggiornato automaticamente</span><button onClick={loadGallery}><RefreshCw size={14}/> Aggiorna</button></div>
    </section>

    <section className="share-section"><div className="share-card"><div><span className="eyebrow">INVITA I TUOI RICORDI</span><h2>Condividi il momento.</h2><p>Inquadra il QR code per aprire l'album {selectedEvent} da un altro telefono.</p></div><button type="button" className="qr-frame qr-zoom-trigger" onClick={() => setShowQrZoom(true)} aria-label="Ingrandisci codice QR" title="Clicca per ingrandire il QR code"><QRCodeSVG value={`${APP_URL}/?evento=${encodeURIComponent(selectedEvent)}`} size={130} bgColor="#fffaf3" fgColor="#651d32" level="M" includeMargin/><span className="qr-zoom-label">Clicca per ingrandire</span></button></div></section>
    <footer className="footer"><span className="footer-mark">C</span><p>Fatto con <Heart size={13} fill="currentColor"/> per Carmine</p><a className="organizer-link" href="/organizzatore"><LockKeyhole size={13}/> Area organizzatore</a><span className="footer-small">UN RICORDO DA CONSERVARE</span></footer>
    {showQrZoom && <div className="qr-modal-backdrop" role="dialog" aria-modal="true" aria-label="Codice QR ingrandito" onClick={() => setShowQrZoom(false)}><section className="qr-modal" onClick={e => e.stopPropagation()}><button className="close-qr-modal" onClick={() => setShowQrZoom(false)} aria-label="Chiudi codice QR" title="Chiudi"><X size={23}/></button><span className="eyebrow">CONDIVIDI L'ALBUM {selectedEvent.toUpperCase()}</span><h2>Inquadra il codice QR</h2><div className="qr-frame qr-frame-large"><QRCodeSVG value={`${APP_URL}/?evento=${encodeURIComponent(selectedEvent)}`} size={280} bgColor="#fffaf3" fgColor="#651d32" level="M" includeMargin/></div><p>Apri la fotocamera del telefono e inquadra il codice per accedere all'album.</p></section></div>}
    {uploadQueue.length > 0 && <div className="upload-modal-backdrop" role="dialog" aria-modal="true" aria-label="Aggiungi didascalie alle foto"><section className="upload-modal"><button className="close-upload-modal" disabled={busy} onClick={closeUploadQueue} aria-label="Chiudi" title="Chiudi"><X size={21}/></button><span className="eyebrow"><Images size={14}/> I TUOI RICORDI</span><h2>Aggiungi una dedica</h2><p className="muted">Scrivi una frase sotto ogni foto, proprio come su una Polaroid. È facoltativo.</p><div className="caption-queue">{uploadQueue.map((item, index) => <article className="caption-queue-item" key={`${item.file.name}-${index}`}><img src={item.preview} alt={`Anteprima foto ${index + 1}`}/><div><label htmlFor={`caption-${index}`}>Didascalia {uploadQueue.length > 1 ? index + 1 : ""}</label><textarea id={`caption-${index}`} maxLength={180} value={item.caption} disabled={busy} onChange={e => updateUploadCaption(index, e.target.value)} placeholder="Es. Una serata indimenticabile!"/><small>{item.caption.length}/180</small></div></article>)}</div><div className="upload-modal-actions"><button className="secondary" disabled={busy} onClick={closeUploadQueue}>Annulla</button><button className="primary" disabled={busy} onClick={submitUploadQueue}>{busy ? "Caricamento…" : `Carica ${uploadQueue.length} ${uploadQueue.length === 1 ? "foto" : "foto"}`}</button></div></section></div>}
    {videoDraft && <div className="upload-modal-backdrop" role="dialog" aria-modal="true" aria-label="Aggiungi un video"><section className="upload-modal"><button className="close-upload-modal" disabled={videoBusy} onClick={closeVideoDraft} aria-label="Chiudi" title="Chiudi"><X size={21}/></button><span className="eyebrow"><Video size={14}/> I TUOI RICORDI</span><h2>Aggiungi un video</h2><p className="muted">Massimo 3 minuti e 50 MB. Per mantenere un buon equilibrio tra qualità e spazio, consigliamo video in HD e compressi dal telefono.</p><video className="video-draft-preview" src={videoDraft.previewUrl} controls playsInline/><label htmlFor="video-caption">Didascalia facoltativa</label><textarea id="video-caption" maxLength={180} value={videoCaption} disabled={videoBusy} onChange={e => setVideoCaption(e.target.value)} placeholder="Es. Il brindisi dei laureati…"/><small>{videoCaption.length}/180 · {Math.round(videoDraft.duration)} secondi · {(videoDraft.file.size / (1024 * 1024)).toFixed(1)} MB</small><div className="upload-modal-actions"><button className="secondary" disabled={videoBusy} onClick={closeVideoDraft}>Annulla</button><button className="primary" disabled={videoBusy} onClick={submitVideo}>{videoBusy ? "Caricamento…" : "Carica video"}</button></div></section></div>}
    {selected && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><button className="close-lightbox" aria-label="Chiudi anteprima" title="Chiudi anteprima" onClick={() => setSelected(null)}><X size={24}/></button><div className="lightbox-polaroid" onClick={e => e.stopPropagation()}>{selected.media_type === "video" ? <video className="lightbox-video" src={selected.url} controls autoPlay playsInline /> : <img src={selected.url} alt="Foto della laurea"/>}<div className="lightbox-caption">{selected.caption || "Un ricordo da conservare"}</div></div>{selected.media_type === "video" ? <a className="download-photo" href={selected.url} download={`laurea-carmine-video-${selected.id}`} onClick={e => e.stopPropagation()}><Download size={16}/> Scarica video</a> : <><p className="save-photo-hint" onClick={e => e.stopPropagation()}>Su iPhone, nel menu Condividi scorri le opzioni e tocca “Salva immagine”.</p><button className="download-photo" onClick={e => { e.stopPropagation(); savePhotoToDevice(selected); }}><Share size={16}/> Salva in Foto</button></>}</div>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
