import bulkDelete from "../../server/handlers/admin-bulk-delete.js";
import eventLinks from "../../server/handlers/admin-event-links.js";
import moderate from "../../server/handlers/admin-moderate.js";
import photos from "../../server/handlers/admin-photos.js";
import downloadZip from "../../server/handlers/admin-download-zip.js";
import review from "../../server/handlers/admin-review.js";
import { json } from "../_supabase.js";

const handlers = {
  "bulk-delete": bulkDelete,
  "event-links": eventLinks,
  moderate,
  photos,
  "download-zip": downloadZip,
  review,
};

export default async function handler(req, res) {
  const action = req.query?.action || new URL(req.url, "http://localhost").pathname.split("/").filter(Boolean).at(-1);
  const routeHandler = handlers[action];
  if (!routeHandler) return json(res, 404, { error: "Endpoint non trovato." });
  return routeHandler(req, res);
}
