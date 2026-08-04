// GET    /api/properties               -> list every property (full JSON documents)
// GET    /api/properties/:id           -> one property's JSON document, or 404
// POST   /api/properties               -> validate + upsert one property
//          body: { data: {...} }                     -> validate + save
//          body: { data: {...}, validateOnly: true }  -> validate only, no save
// POST   /api/properties/:id/archive   -> mark archived (kept, just hidden from the active pipeline)
// POST   /api/properties/:id/unarchive -> clear archived, back into the active pipeline
// DELETE /api/properties/:id           -> permanently remove the property (no undo — the
//          frontend is the one place that confirms this before calling it)
//
// Write access here isn't gated by a second passcode check — the whole
// app (including this route) already sits behind the one session-cookie
// gate in lib/auth.mjs. That's the only guardrail, on purpose.
import express from "express";
import { listProperties, getProperty, upsertProperty, deleteProperty } from "../lib/db.mjs";
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

router.delete("/:id", async (req, res) => {
  try {
    const removed = await deleteProperty(req.params.id);
    if (!removed) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }
    res.status(200).json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/:id/archive", (req, res) => setArchived(req, res, true));
router.post("/:id/unarchive", (req, res) => setArchived(req, res, false));

// Shared by the archive/unarchive routes above — load the existing
// document, flip the flag, validate, save. A separate action from the
// general upsert so the frontend doesn't have to round-trip the whole
// card just to toggle this one thing.
async function setArchived(req, res, archived) {
  try {
    const existing = await getProperty(req.params.id);
    if (!existing) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }
    const updated = { ...existing, archived, archivedAt: archived ? new Date().toISOString() : null };
    const check = validateProperty(updated);
    if (!check.ok) {
      res.status(400).json({ ok: false, errors: check.errors });
      return;
    }
    await upsertProperty(check.data.id, check.data);
    res.status(200).json({ ok: true, property: check.data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
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
    // canonical `purchasePrice`, falling back to the legacy `landPrice` key
    purchasePrice: fin.purchasePrice ?? fin.landPrice ?? null,
    totalProjectCost: fin.totalProjectCost ?? null,
    yieldOnCost: fin.yieldOnCost ?? null,
    exitValue: fin.exitValue ?? null,
  };
}

export default router;
