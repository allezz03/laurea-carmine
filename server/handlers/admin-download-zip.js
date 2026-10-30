import { supabaseAdmin, json, checkAdmin, methodNotAllowed } from "../../api/_supabase.js";

const MAX_FILES = 300;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function safeName(value) {
  return String(value || "foto").normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "foto";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!checkAdmin(req)) return json(res, 401, { error: "Password organizzatore non valida." });

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("photos")
      .select("id, storage_path, created_at, event, media_type, mime_type")
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(MAX_FILES);
    if (error) throw error;

    const photos = (data || []).filter(photo => photo.media_type !== "video" && photo.storage_path);
    if (!photos.length) return json(res, 404, { error: "Non ci sono foto approvate da scaricare." });
    if ((data || []).length >= MAX_FILES) {
      return json(res, 413, { error: `Ci sono almeno ${MAX_FILES} contenuti: per sicurezza l'archivio è limitato a ${MAX_FILES} elementi. Scarica le foto in più sessioni.` });
    }

    const entries = [];
    let totalBytes = 0;
    for (let index = 0; index < photos.length; index++) {
      const photo = photos[index];
      const { data: file, error: downloadError } = await supabase.storage.from("laurea-photos").download(photo.storage_path);
      if (downloadError || !file) {
        console.error("zip download error:", photo.id, downloadError?.message);
        continue;
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      totalBytes += buffer.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return json(res, 413, { error: "Le foto superano 120 MB complessivi. Per sicurezza scaricale in più sessioni." });
      }
      const extension = (photo.mime_type || file.type || "image/jpeg").split("/")[1]?.split(";")[0] || "jpg";
      const eventFolder = safeName(photo.event || "Album");
      const fileName = `${String(index + 1).padStart(3, "0")}-${safeName(photo.id)}.${extension === "jpeg" ? "jpg" : safeName(extension)}`;
      entries.push({ name: `${eventFolder}/${fileName}`, data: buffer });
    }

    if (!entries.length) return json(res, 500, { error: "Non è stato possibile recuperare le foto da Supabase Storage." });
    const archive = makeZip(entries);
    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="laurea-carmine-foto.zip"');
    res.setHeader("Content-Length", String(archive.length));
    res.setHeader("Cache-Control", "no-store");
    return res.send(archive);
  } catch (error) {
    console.error("admin zip error:", error?.message || error);
    return json(res, 500, { error: "Non è stato possibile creare lo ZIP delle foto." });
  }
}
