// POST /api/materials/:propertyId       -> upload one file onto a property's
//        materials[category] list. body: { category, filename, contentType, dataBase64 }
//        -- or, to set one of the property's single "hero" images instead
//        (e.g. the concept site plan rendered on the card) --
//        body: { imageKey, filename, contentType, dataBase64 } — writes the
//        uploaded file's URL to images[imageKey] instead of appending to a
//        materials category.
// GET  /api/materials/file/:fileId/:name -> serve back an uploaded file's bytes
//        (:name is cosmetic — only used for the download filename — the
//        lookup is by :fileId)
//
// Why this exists instead of just writing to uploads/: that folder only
// works because its contents are committed to git and baked into the
// deployment at build time (see vercel.json's includeFiles) — a Vercel
// serverless function's filesystem is not writable/persistent at runtime,
// so there's nowhere on disk to actually save a file a user uploads through
// the browser. Postgres is the one piece of infra this app already has, so
// uploaded bytes live in the material_files table instead. The property
// JSON's materials[category][].file field still holds a plain URL — never
// base64 — same contract schema/property-schema.mjs already documents.
import crypto from "node:crypto";
import express from "express";
import { getProperty, upsertProperty, saveMaterialFile, getMaterialFile } from "../lib/db.mjs";
import { validateProperty } from "../schema/property-schema.mjs";

const router = express.Router();

// Comfortably under Vercel's ~4.5MB serverless request-body ceiling once
// this file is base64-encoded (~33% larger) plus the JSON envelope.
const MAX_FILE_BYTES = 3 * 1024 * 1024;

router.post("/:propertyId", async (req, res) => {
  const { category, filename, contentType, dataBase64, imageKey } = req.body || {};
  if (imageKey && typeof imageKey !== "string") {
    res.status(400).json({ ok: false, error: "imageKey must be a string" });
    return;
  }
  if (!imageKey && (!category || typeof category !== "string")) {
    res.status(400).json({ ok: false, error: "category is required" });
    return;
  }
  if (!filename || typeof filename !== "string") {
    res.status(400).json({ ok: false, error: "filename is required" });
    return;
  }
  if (!dataBase64 || typeof dataBase64 !== "string") {
    res.status(400).json({ ok: false, error: "dataBase64 is required" });
    return;
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, "base64");
  } catch {
    res.status(400).json({ ok: false, error: "dataBase64 is not valid base64" });
    return;
  }
  if (buffer.length === 0) {
    res.status(400).json({ ok: false, error: "File is empty" });
    return;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    res.status(413).json({ ok: false, error: `File is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB) — max 3MB. For a bigger file, paste a link to where it already lives (Google Drive, Dropbox, etc.) via View/edit JSON instead.` });
    return;
  }

  try {
    const property = await getProperty(req.params.propertyId);
    if (!property) {
      res.status(404).json({ ok: false, error: "Property not found" });
      return;
    }

    const fileId = crypto.randomUUID();
    await saveMaterialFile({ id: fileId, propertyId: property.id, filename, contentType, data: buffer });
    const url = `/api/materials/file/${fileId}/${encodeURIComponent(filename)}`;

    let updated;
    let material = null;
    if (imageKey) {
      updated = { ...property, images: { ...(property.images || {}), [imageKey]: url } };
    } else {
      material = {
        name: filename,
        file: url,
        meta: `Uploaded ${new Date().toISOString().slice(0, 10)} · ${(buffer.length / 1024).toFixed(0)} KB`,
        s: "source",
      };
      updated = { ...property, materials: { ...(property.materials || {}) } };
      updated.materials[category] = [...(updated.materials[category] || []), material];
    }

    const check = validateProperty(updated);
    if (!check.ok) {
      res.status(400).json({ ok: false, errors: check.errors });
      return;
    }
    await upsertProperty(check.data.id, check.data);
    res.status(200).json({ ok: true, property: check.data, material, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/file/:fileId/:filename", async (req, res) => {
  try {
    const file = await getMaterialFile(req.params.fileId);
    if (!file) {
      res.status(404).send("Not found");
      return;
    }
    res.setHeader("Content-Type", file.content_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename || req.params.filename)}"`);
    res.status(200).send(file.data);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
