// GET /api/properties/:id -> one property's JSON document, or 404
import { getProperty } from "../../lib/db.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { id } = req.query;
  try {
    const property = await getProperty(id);
    if (!property) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({ property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
