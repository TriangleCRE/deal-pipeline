// GET  /api/properties        -> list every property (full JSON documents)
// POST /api/properties        -> validate + upsert one property (passcode required)
//        body: { data: {...} }                     -> validate + save
//        body: { data: {...}, validateOnly: true }  -> validate only, no save, no passcode needed
import { listProperties, upsertProperty } from "../../lib/db.mjs";
import { validateProperty } from "../../schema/property-schema.mjs";
import { checkPasscode } from "../../lib/auth.mjs";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const properties = await listProperties();
      res.status(200).json({ properties });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const check = validateProperty(body.data);
    if (!check.ok) {
      res.status(400).json({ ok: false, errors: check.errors });
      return;
    }

    if (body.validateOnly) {
      res.status(200).json({ ok: true, preview: buildPreview(check.data) });
      return;
    }

    const auth = checkPasscode(req);
    if (!auth.ok) {
      res.status(auth.status).json({ ok: false, error: auth.message });
      return;
    }

    try {
      await upsertProperty(check.data.id, check.data);
      res.status(200).json({ ok: true, id: check.data.id, preview: buildPreview(check.data) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}

// A small, cheap-to-render summary for the upload preview step.
function buildPreview(p) {
  const fin = p.financing || {};
  return {
    id: p.id,
    name: p.name,
    dealType: p.dealType || null,
    status: p.status || null,
    scores: p.scores || null,
    landPrice: fin.landPrice ?? null,
    totalProjectCost: fin.totalProjectCost ?? null,
    yieldOnCost: fin.yieldOnCost ?? null,
    exitValue: fin.exitValue ?? null,
  };
}
