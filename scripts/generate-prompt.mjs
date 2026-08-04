// Generates prompt/data-entry-prompt.md from schema/property-schema.mjs.
// Run with: npm run gen:prompt
//
// Re-run this whenever the schema changes — the "Copy data-entry prompt"
// button in the app just serves the committed output of this script as a
// static file, so the prompt and the schema are generated from the same
// source and can't quietly drift apart.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION, FIELD_GUIDE } from "../schema/property-schema.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// A trimmed, representative example — enough to make the shape unambiguous
// without reproducing the full seeded card.
const EXAMPLE = {
  schemaVersion: SCHEMA_VERSION,
  id: "1200-example-pkwy",
  name: "1200 Example Pkwy",
  address: "1200 Example Pkwy, Anytown, VA 22222",
  county: "Anytown County, VA",
  parcels: "TMP 12-A-3",
  status: "Under Review",
  dealType: "Property-Driven",
  tags: ["Hard corner", "Retail + Self-Storage"],
  updated: "2026-08-04",
  headlineTenant: { name: "Example Retailer", logo: null },
  meta: { dealId: "TRI-2026-002", entity: "Triangle Investment Group", prepared: "S. Dahl · Aug 2026", sourceModel: "Example Financial Model v1" },
  thesis: { v: "Signalized hard corner with an interested anchor tenant; rezoning is the key risk.", s: "ai" },
  flags: [
    { type: "opp", text: "Anchor tenant has expressed interest.", s: "source" },
    { type: "risk", text: "Requires rezoning from residential to commercial.", s: "source" },
  ],
  scoreProvenance: "ai",
  scores: { location: 4, traffic: 4, demographics: 3, zoning: 2, siteLayout: 4, tenantDemand: 3, rentPotential: 3, devCost: 3, exitLiquidity: 3 },
  scoreNotes: { location: "Hard corner on a major arterial.", zoning: "Rezoning required, not guaranteed." },
  financing: { landPrice: 1000000, retailSF: 6000, retailRentPSF: 26, totalProjectCost: 5000000, loanLTC: 0.7, exitCap: 0.075 },
  financingNote: { pencil: { v: "Pencils at current assumptions.", s: "ai" } },
  propertyInfo: [
    { k: "Address", d: { v: "1200 Example Pkwy", s: "source" } },
    { k: "Current zoning", d: { v: "R-1 — requires rezoning to commercial", s: "source" } },
  ],
  gis: [{ k: "Frontage", d: { v: "±400 ft on Example Pkwy", s: "source" } }],
  market: [{ k: "Traffic (AADT)", d: { v: "≈18,000 vehicles/day", s: "web", n: "State DOT count, 2025." } }],
  zoning: [{ k: "Current → target", d: { v: "R-1 → B-2", s: "source" } }],
  hbu: [{ k: "Primary use", d: { v: "Single-tenant retail anchor", s: "ai" } }],
  history: { s: "source", bullets: [{ t: "Owner motivated", d: "Seller wants to close quickly.", s: "source" }] },
  surroundings: { s: "web", items: [{ name: "Example Grocery (adjacent)", rel: "Adjacent, shared curb cut", type: "opp", note: "Drives cross-shopping traffic." }] },
  tenants: [{ name: "Example Retailer", logo: null, status: "Interested — anchor", cls: "badge-ok", note: "LOI in progress.", s: "source" }],
  contacts: [{ role: "Listing Broker", name: "Jane Broker", org: "Example Realty", detail: "jane@example.com", s: "source" }],
  checklist: { A: [{ item: "Address, parcel ID", status: "done", response: "1200 Example Pkwy; TMP 12-A-3", s: "source" }] },
  materials: { financingModel: [{ name: "Example Financial Model v1", file: "uploads/1200-example-pkwy/example-model.xlsx", meta: "Base case", s: "source" }] },
  extras: [{ label: "Regional context", text: "20 minutes from the county seat.", s: "source" }],
  sources: [{ label: "County GIS parcel viewer", url: "https://example-county.gov/gis" }],
  images: { sitePlan: "uploads/1200-example-pkwy/site-plan.svg" },
};

const guideText = FIELD_GUIDE.map(
  (s) => `### ${s.section}\n${s.fields.map((f) => `- ${f}`).join("\n")}`
).join("\n\n");

const prompt = `<!--
  GENERATED FILE — do not hand-edit. Regenerate with:
    npm run gen:prompt
  Source of truth: schema/property-schema.mjs (SCHEMA_VERSION, FIELD_GUIDE)
-->
# Deal data-entry prompt (schema v${SCHEMA_VERSION})

Paste this whole prompt into your own Claude, along with the deal materials
for one property (offering memorandum, survey, financial model, notes,
emails, etc.), then paste Claude's JSON output into the "Upload JSON" box on
the Deal Pipeline page.

---

You are filling out ONE structured JSON document describing a commercial
real-estate deal for Triangle Investment Group's deal pipeline tool. You will
be given deal materials (an offering memorandum, survey, financial model,
notes, emails, etc.). Read them carefully and produce a single JSON object
matching the schema below.

Rules:
1. Fill in every field the materials support. If a field isn't supported by
   the materials or your research, either omit it or set its value to null —
   the app renders missing fields as "Needs input." Do not delete the key
   entirely if the shape expects an object/array; just leave it thin.
2. Every fact that has a value must be tagged with the source it came from,
   using the \`s\` (or \`d.s\`) property, one of:
   - "source" — directly from the attached deal materials (GIS, survey,
     financing model, email, notes)
   - "web"    — you looked it up online; cite it in a "sources" entry
   - "ai"     — your own estimate or inference; flag it as unverified
   - "need"   — you don't know it; DO NOT GUESS, mark it "need" instead
3. Never invent numbers, contacts, or citations. If you're not confident,
   use "ai" and say so in a note, or use "need" and leave it blank.
4. Never embed file contents (no base64, no data: URIs). For \`materials\`,
   \`sources\`, \`images\`, and any logo, reference the file by its filename
   or link only — wherever the actual file already lives.
5. \`scores\` are raw 1-5 inputs per factor — never compute or send a total
   score; the app computes the weighted score itself.
6. \`id\` should be a short, lowercase, hyphenated slug derived from the
   property name/address (e.g. "6968-seminole-trail").
7. Output ONLY the JSON object. No commentary, no markdown code fence, no
   explanation before or after it.

## Schema (schemaVersion ${SCHEMA_VERSION})

Only \`id\` and \`name\` are required. Everything else is optional — a
missing section just renders as "Needs input."

${guideText}

## Example (trimmed — shows the shape, not real data)

\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`
`;

const outDir = path.join(ROOT, "prompt");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "data-entry-prompt.md");
fs.writeFileSync(outPath, prompt);
console.log(`wrote ${path.relative(ROOT, outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
