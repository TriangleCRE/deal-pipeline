// ONE-TIME MIGRATION UTILITY.
//
// The old index.html stored property data (including deal materials) as a
// giant `window.TRIANGLE_PROPERTIES` JS array literal, with PDFs/images/xlsx
// embedded inline as base64 data: URIs. This script:
//   1. Evaluates that array out of the current index.html (in a sandboxed
//      vm context — no network, no real DOM).
//   2. Pulls every embedded base64 data: URI out to a real file under
//      /uploads/<id>/<file>, and rewrites the JSON to reference it by path
//      instead of embedding it.
//   3. Adds schemaVersion and validates the result against schema/property-schema.mjs.
//   4. Writes one JSON file per property to data/seed/<id>.json.
//
// Re-run only if you need to re-derive the seed JSON from a pre-migration
// index.html. Normal day-to-day editing happens through the app now
// (Upload JSON / View-edit JSON), not this script.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION, validateProperty } from "../schema/property-schema.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const start = html.indexOf("<script>") + "<script>".length;
const end = html.lastIndexOf("</script>");
let code = html.slice(start, end);

// Strip the trailing DOM-router bootstrap — we only need the top-level
// `window.TRIANGLE_PROPERTIES = [...]` assignment and function declarations
// (which just get defined, not called) to evaluate cleanly with no DOM.
code = code.replace(/window\.addEventListener\('hashchange',route\);route\(\);\s*$/, "");

const sandboxWindow = {};
const noop = () => {};
const context = {
  window: sandboxWindow,
  document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: noop, body: { classList: { toggle: noop } } },
  location: { hash: "" },
  navigator: {},
  console,
};
context.window.addEventListener = noop;
vm.createContext(context);
vm.runInContext(code, context, { filename: "index.html<script>" });

const properties = context.window.TRIANGLE_PROPERTIES;
if (!Array.isArray(properties) || !properties.length) {
  throw new Error("Could not extract window.TRIANGLE_PROPERTIES from index.html");
}
console.log(`Extracted ${properties.length} propert${properties.length === 1 ? "y" : "ies"} from index.html`);

const MIME_EXT = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const DATA_URI_RE = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/;

function slugify(s) {
  const v = String(s || "file").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return v || "file";
}

function extractDataUris(node, ctx) {
  if (Array.isArray(node)) {
    node.forEach((item) => extractDataUris(item, ctx));
    return;
  }
  if (node && typeof node === "object") {
    const label = typeof node.name === "string" ? node.name : typeof node.label === "string" ? node.label : null;
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === "string") {
        const m = DATA_URI_RE.exec(v);
        if (m) {
          const ext = MIME_EXT[m[1]] || "bin";
          const base = slugify(label || k);
          let filename = `${base}.${ext}`;
          let n = 2;
          while (ctx.used.has(filename)) { filename = `${base}-${n}.${ext}`; n++; }
          ctx.used.add(filename);
          const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
          fs.mkdirSync(ctx.dir, { recursive: true });
          fs.writeFileSync(path.join(ctx.dir, filename), buf);
          node[k] = `/uploads/${ctx.id}/${filename}`;
          ctx.extracted.push({ field: k, filename, bytes: buf.length });
        }
      } else if (v && typeof v === "object") {
        extractDataUris(v, ctx);
      }
    }
  }
}

const seedDir = path.join(ROOT, "data", "seed");
fs.mkdirSync(seedDir, { recursive: true });

for (const property of properties) {
  const ctx = {
    id: property.id,
    dir: path.join(ROOT, "uploads", property.id),
    used: new Set(),
    extracted: [],
  };
  extractDataUris(property, ctx);
  property.schemaVersion = SCHEMA_VERSION;

  const check = validateProperty(property);
  if (!check.ok) {
    console.error(`Schema validation FAILED for ${property.id}:`);
    check.errors.forEach((e) => console.error(`  ${e.path}: ${e.message}`));
    process.exitCode = 1;
    continue;
  }

  const outPath = path.join(seedDir, `${property.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(check.data, null, 2) + "\n");

  const totalBytes = ctx.extracted.reduce((s, e) => s + e.bytes, 0);
  console.log(`\n${property.id}:`);
  console.log(`  extracted ${ctx.extracted.length} file(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MB -> uploads/${property.id}/`);
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
