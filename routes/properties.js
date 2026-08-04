// GET  /api/properties        -> list every property (full JSON documents)
// GET  /api/properties/:id    -> one property's JSON document, or 404
// POST /api/properties        -> validate + upsert one property
//        body: { data: {...} }                     -> validate + save
//        body: { data: {...}, validateOnly: true }  -> validate only, no save
//
// Write access here isn't gated by a second passcode check — the whole
// app (including this route) already sits behind the one session-cookie
// gate in lib/auth.mjs. That's the only guardrail, on purpose.
import express from "express";
import { listProperties, getProperty, upsertProperty } from "../lib/db.mjs";
import { validateProperty } from "../schema/property-schema.mjs";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const properties = await listProperties();
    res.status(200).json({ properties });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const property = await getProperty(req.params.id);
    if (!property) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({ property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
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

  try {
    await upsertProperty(check.data.id, check.data);
    res.status(200).json({ ok: true, id: check.data.id, preview: buildPreview(check.data) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// A small, cheap-to-render summary for the upload preview step.
function buildPreview(p) {
  const fin = p.financing || {};
  return {
    id: p.id,
    name: p.name,
    dealType: p.dealType || null,
    status: p.status || null,
    scores: p.scores || null,
    // canonical `purchasePrice`, falling back to the legacy `landPrice` key
    purchasePrice: fin.purchasePrice ?? fin.landPrice ?? null,
    totalProjectCost: fin.totalProjectCost ?? null,
    yieldOnCost: fin.yieldOnCost ?? null,
    exitValue: fin.exitValue ?? null,
  };
}

export default router;
