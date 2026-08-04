// Triangle Deal Pipeline — canonical property schema.
//
// This is the ONE file that defines what a property JSON document looks like.
// It is used to:
//   1. Validate every upload (see api/properties.js).
//   2. Generate the Claude data-entry prompt (see scripts/generate-prompt.mjs)
//      so the prompt and the schema can never drift apart — edit fields here
//      and both the validator and the generated prompt pick it up.
//
// Design: one JSONB blob per property. Everything below is OPTIONAL except
// `id` and `name` — a missing section just renders as "Needs input" on the
// card. Don't add required fields here without a very good reason.

import { z } from "zod";

export const SCHEMA_VERSION = 1;

// The four provenance markers every fact on a card is tagged with.
export const PROVENANCE_KEYS = ["source", "web", "ai", "need"];
const prov = () => z.enum(PROVENANCE_KEYS).optional();

// A single sourced fact: { v: value, s: provenance, n: optional note }
const fact = (valueSchema = z.any()) =>
  z.object({ v: valueSchema.optional(), s: prov(), n: z.string().optional() }).passthrough();

// A labeled fact row used in the flat "section fields" lists
// (Property Info, GIS, Market, Zoning, Highest & Best Use).
const fieldRow = z.object({ k: z.string().optional(), d: fact().optional() }).passthrough();

const flag = z.object({
  type: z.enum(["opp", "risk", "watch"]).optional(),
  text: z.string().optional(),
  s: prov(),
}).passthrough();

const tenant = z.object({
  name: z.string().optional(),
  logo: z.string().nullable().optional(),
  status: z.string().optional(),
  cls: z.string().optional(),
  note: z.string().optional(),
  s: prov(),
}).passthrough();

const contact = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  org: z.string().optional(),
  detail: z.string().optional(),
  bg: z.string().optional(),
  s: prov(),
}).passthrough();

const checklistItem = z.object({
  item: z.string().optional(),
  status: z.enum(["done", "prog", "none", "flag"]).optional(),
  response: z.string().optional(),
  note: z.string().optional(),
  s: prov(),
}).passthrough();

const material = z.object({
  name: z.string().optional(),
  // link/filename only — deal materials live wherever they already live
  // (e.g. /uploads/<id>/<file>, or an external URL). Never a data: URI.
  file: z.string().optional(),
  meta: z.string().optional(),
  s: prov(),
}).passthrough();

const source = z.object({
  label: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Scoring + checklist reference data — mirrors index.html's TRI engine
// (SCORE_CRITERIA_BY_TYPE / CHECKLIST_TEMPLATE_BY_TYPE) exactly. Duplicated
// here (rather than imported) because index.html is a single inline script,
// not an importable module. If you change the scorecard or checklist in
// index.html, change it here too — scripts/generate-prompt.mjs uses these
// to tell Claude the real score factors and checklist items per dealType,
// instead of just pointing at "the app's templates" and hoping for the best.
// ---------------------------------------------------------------------------
export const SCORE_CRITERIA_BY_TYPE = {
  "Property-Driven": [
    { id: "location", label: "Location Quality", weight: 2.0, hint: "5 = dominant corridor / hard corner · 3 = workable · 1 = weak" },
    { id: "traffic", label: "Traffic", weight: 1.5, hint: "5 = very high AADT / visibility · 1 = low counts" },
    { id: "demographics", label: "Demographics", weight: 1.25, hint: "5 = strong income + growth + density · 1 = weak" },
    { id: "zoning", label: "Zoning Risk", weight: 1.5, hint: "5 = by-right / very low risk · 3 = moderate approval risk · 1 = rezoning / political risk" },
    { id: "siteLayout", label: "Site Layout Efficiency", weight: 1.25, hint: "5 = highly efficient fit · 1 = constrained / poor yield" },
    { id: "tenantDemand", label: "Tenant Demand", weight: 2.0, hint: "5 = deep demand / signed interest · 1 = limited demand" },
    { id: "rentPotential", label: "Rent Potential", weight: 2.0, hint: "5 = materially above target · 3 = at target · 1 = below" },
    { id: "devCost", label: "Development Cost Risk", weight: 1.5, hint: "5 = low / predictable cost · 1 = high / uncertain cost" },
    { id: "exitLiquidity", label: "Exit Liquidity", weight: 1.5, hint: "5 = broad buyer pool / easy exit · 1 = thin buyer pool" },
  ],
  "Tenant-Driven": [
    { id: "tenantFit", label: "Tenant Requirement Fit", weight: 2.0, hint: "5 = site matches all tenant criteria · 3 = workable with tradeoffs · 1 = major gaps" },
    { id: "tradeArea", label: "Trade Area Strength", weight: 1.5, hint: "5 = dominant corridor, thin competition · 1 = weak / saturated" },
    { id: "siteAvailability", label: "Site Availability", weight: 1.25, hint: "5 = multiple viable sites identified · 1 = few or no options" },
    { id: "siteFeasibility", label: "Site-Level Feasibility", weight: 1.5, hint: "5 = clean access/utilities/zoning · 1 = major constraints" },
    { id: "tenantCommitment", label: "Tenant Commitment", weight: 2.0, hint: "5 = LOI signed, economics aligned · 1 = exploratory only" },
    { id: "dealEconomics", label: "Deal Economics", weight: 2.0, hint: "5 = yield on cost well above target · 3 = at target · 1 = below" },
    { id: "entitlementRisk", label: "Entitlement & Timeline Risk", weight: 1.5, hint: "5 = by-right, fast timeline · 1 = rezoning/SUP required, slow" },
    { id: "executionReadiness", label: "Execution Readiness", weight: 1.25, hint: "5 = site control secured, budget final · 1 = early stage" },
  ],
};

export const CHECKLIST_TEMPLATE_BY_TYPE = {
  "Property-Driven": [
    { id: "A", title: "Property Information", items: ["Address, parcel ID", "Acreage", "Ownership structure", "Asking price / basis", "Current zoning", "Existing improvements", "Utilities status"] },
    { id: "B", title: "Market & Location Analysis", items: ["Traffic counts", "Visibility", "Retail corridor strength", "Nearby anchors", "Competition mapping", "Demographics", "Growth trends", "Daytime population"] },
    { id: "C", title: "Highest & Best Use", items: ["Single-tenant net lease", "Multi-tenant strip center", "Mixed-use potential", "Pad development strategy", "Phasing potential"] },
    { id: "D", title: "Site Planning Test Fit", items: ["Building footprints", "Parking layout", "Drive-thru feasibility", "Truck access", "Stormwater requirements"] },
    { id: "E", title: "Entitlement & Risk", items: ["Zoning compliance", "Rezoning required", "Political risk", "Planning timeline", "Municipal constraints"] },
    { id: "F", title: "Deal Economics", items: ["Land basis", "Development cost", "Rent assumptions", "Stabilized NOI", "Exit value", "Yield on cost", "Sensitivity analysis"] },
    { id: "G", title: "Tenant Targeting", items: ["Identify tenant categories", "Build tenant list", "Match tenants to layout"] },
    { id: "H", title: "Tenant Outreach", items: ["Create site package", "Broker outreach", "Direct outreach", "Track feedback", "Iterate site plan", "Secure LOIs"] },
    { id: "I", title: "Deal Execution", items: ["Pre-lease thresholds", "Finalize site plan", "Secure financing", "Execute leases", "Begin construction"] },
  ],
  "Tenant-Driven": [
    { id: "A", title: "Tenant Requirement Definition", items: ["Confirm tenant type (Ground lease / BTS / inline)", "Required building size (SF range)", "Site size requirement (acres)", "Parking requirements", "Drive-thru requirements", "Visibility requirements", "Traffic count thresholds", "Demographic requirements", "Co-tenancy preferences", "Prohibited adjacencies", "Market priority ranking", "Timeline", "Prototype / site plan requirements"] },
    { id: "B", title: "Market Mapping & Trade Area Identification", items: ["Define target trade areas", "Map competitor locations", "Identify gaps / white space", "Identify dominant retail corridors", "Rank corridors", "Confirm traffic counts", "Identify anchor centers"] },
    { id: "C", title: "Site Identification", items: ["Vacant land parcels", "Redevelopment opportunities", "Outparcels", "Assemblage opportunities", "Broker outreach", "Off-market outreach", "Public land opportunities", "Ground lease opportunities"] },
    { id: "D", title: "Site-Level Feasibility", items: ["Parcel size & dimensions", "Topography", "Access / ingress-egress", "Visibility", "Utilities availability", "Environmental concerns", "Floodplain / wetlands", "Zoning compliance", "Drive-thru allowance", "Parking compliance", "Setbacks / height", "Signage limitations", "Rezoning or SUP required"] },
    { id: "E", title: "Deal Economics", items: ["Land cost", "Construction cost", "Soft costs", "Tenant rent", "Yield on cost", "Exit cap rate", "Developer fee", "Available incentives"] },
    { id: "F", title: "Tenant Engagement", items: ["Present site options", "Gather feedback", "Secure LOI", "Confirm lease economics", "Align on site plan"] },
    { id: "G", title: "Site Control & Execution", items: ["Secure PSA / ground lease", "Negotiate contingencies", "Begin entitlements", "Execute lease", "Finalize budget", "Move to financing and construction"] },
  ],
};

export const PropertySchema = z.object({
  schemaVersion: z.number().int().optional(),

  /* ---- basics ---- */
  id: z.string().min(1, "id is required (used as the URL slug / primary key)"),
  name: z.string().min(1, "name is required"),
  address: z.string().optional(),
  county: z.string().optional(),
  parcels: z.string().optional(),
  status: z.string().optional(),
  dealType: z.enum(["Property-Driven", "Tenant-Driven"]).optional(),
  tags: z.array(z.string()).optional(),
  updated: z.string().optional(),
  headlineTenant: z.object({
    name: z.string().optional(),
    logo: z.string().nullable().optional(),
  }).passthrough().optional(),
  meta: z.object({
    dealId: z.string().optional(),
    entity: z.string().optional(),
    prepared: z.string().optional(),
    sourceModel: z.string().optional(),
  }).passthrough().optional(),

  /* ---- thesis + flags ---- */
  thesis: fact(z.string()).optional(),
  flags: z.array(flag).optional(),

  /* ---- weighted scoring (1-5 per factor; the app computes the weighted
     total from these — do not send a computed score) ---- */
  scoreProvenance: prov(),
  scores: z.record(z.string(), z.number()).nullable().optional(),
  scoreNotes: z.record(z.string(), z.string()).optional(),

  /* ---- financing model inputs (the app derives NOI/IRR/etc. from these) ---- */
  financing: z.record(z.string(), z.any()).nullable().optional(),
  financingNote: z.object({
    pencil: fact(z.string()).optional(),
    listAsk: fact(z.string()).optional(),
  }).passthrough().optional(),

  /* ---- flat section fields ---- */
  propertyInfo: z.array(fieldRow).optional(),
  gis: z.array(fieldRow).optional(),
  market: z.array(fieldRow).optional(),
  zoning: z.array(fieldRow).optional(),
  hbu: z.array(fieldRow).optional(),

  /* ---- narrative sections ---- */
  history: z.object({
    s: prov(),
    bullets: z.array(z.object({ t: z.string().optional(), d: z.string().optional(), s: prov() }).passthrough()).optional(),
  }).passthrough().optional(),
  surroundings: z.object({
    s: prov(),
    items: z.array(z.object({
      name: z.string().optional(),
      rel: z.string().optional(),
      type: z.enum(["opp", "watch"]).optional(),
      note: z.string().optional(),
    }).passthrough()).optional(),
  }).passthrough().optional(),

  tenants: z.array(tenant).optional(),
  contacts: z.array(contact).optional(),

  /* ---- development checklist, keyed by section letter (A, B, C, ...) ---- */
  checklist: z.record(z.string(), z.array(checklistItem)).optional(),

  /* ---- deal materials, keyed by category id (financingModel, gis, siteMap,
     survey, scoring, other) — link/filename only, never embedded base64 ---- */
  materials: z.record(z.string(), z.array(material)).optional(),

  extras: z.array(z.object({
    label: z.string().optional(),
    text: z.string().optional(),
    s: prov(),
  }).passthrough()).optional(),

  sources: z.array(source).optional(),

  images: z.object({
    sitePlan: z.string().optional(),
  }).passthrough().optional(),
}).passthrough(); // unknown top-level keys are kept, not rejected

// The data-entry prompt (see prompt/data-entry-prompt.md, rule 8) tells
// Claude a field it has nothing for can be either omitted or set to `null`
// — both are meant to mean "no data." Most fields above are plain
// `z.string().optional()` etc., which accepts a missing key but NOT an
// explicit `null` (only a few, like `logo`, are `.nullable()` too). That
// mismatch is exactly what broke meta.dealId being sent as `null`. Rather
// than chase down and `.nullable()` every field a future prompt tweak might
// null out, treat null as "not provided" everywhere, once, here — so the
// validator actually honors the contract the prompt promises.
function stripNulls(value) {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== null).map(stripNulls);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null) continue; // drop it — same as the key never being sent
      out[k] = stripNulls(v);
    }
    return out;
  }
  return value;
}

/**
 * Validate a candidate property document.
 * Returns { ok: true, data } or { ok: false, errors: [{ path, message }] }.
 * Never throws.
 */
export function validateProperty(candidate) {
  const result = PropertySchema.safeParse(stripNulls(candidate));
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}

// ---------------------------------------------------------------------------
// FIELD_GUIDE — a human-readable walk of the sections above, in the same
// order, used to generate the Claude data-entry prompt. Kept in this file
// (next to the zod shape it describes) so a schema change and a prompt
// change happen in the same edit, not two files that can drift apart.
// ---------------------------------------------------------------------------
export const FIELD_GUIDE = [
  { section: "Basics", fields: [
    "id — url slug, e.g. \"6968-seminole-trail\" (lowercase, hyphenated)",
    "name, address, county, parcels, status (pipeline stage, e.g. \"Under Review\")",
    "dealType — \"Property-Driven\" or \"Tenant-Driven\"",
    "tags — array of short strings",
    "updated — YYYY-MM-DD",
    "headlineTenant: { name, logo } — logo is a link/filename, never base64",
    "meta: { dealId, entity, prepared, sourceModel }",
  ]},
  { section: "Investment thesis & flags", fields: [
    "thesis: { v: \"1-3 sentence summary\", s: provenance }",
    "flags: [{ type: \"opp\"|\"risk\"|\"watch\", text, s }]",
  ]},
  { section: "Weighted score (1-5 each factor, app computes the total)", fields: [
    "scoreProvenance — provenance for the score set as a whole",
    "scores — use the id from the score-factor table for this deal's dealType (below) as the key, 1-5 as the value. Never send a computed/weighted total — the app computes it from these raw inputs.",
    "scoreNotes — { <same key>: \"one-line rationale\" } — a short justification per factor, the same way the example does",
  ]},
  { section: "Financing model inputs (app computes NOI/IRR/etc.)", fields: [
    "financing — a free-form bag of plain numbers pulled straight from the deal's model — there is no fixed set of keys. The example below (landPrice, retailSF, retailRentPSF, storageSF, storageCostPSF, storageRentPSF, softCosts, totalProjectCost, loanLTC, loan, equity, interestRate, amortYears, holdYears, exitCap, costOfSale, stabilizedNOI, yieldOnCost, exitValue, leveredIRR, equityMultiple, cashOnCash, dscr, storageSensitivity: [{rent,yoc,spread}, ...]) is from a retail + self-storage deal — reuse whatever of those genuinely apply, but for a different asset class use whatever key names actually describe THAT model's line items (e.g. unitCount/avgUnitRentPSF for multifamily, warehouseSF/officeSF/clearHeightFt for industrial, lotCount/lotPricePerAcre for land, baseRentPSF/percentageRent for a ground lease). Match the model in front of you, don't force it into someone else's shape.",
    "financingNote: { pencil: {v,s}, listAsk: {v,s} } — call out if the deal does or doesn't pencil, and any price-to-reconcile note",
  ]},
  { section: "Property Information / GIS / Market / Zoning / Highest & Best Use", fields: [
    "propertyInfo, gis, market, zoning, hbu — each an array of { k: \"label\", d: { v: \"value\", s, n: \"optional note\" } }. The labels are free-form too — use whatever's relevant to this property's actual type. A retail corner cares about traffic counts and visibility; a warehouse cares about clear height and dock doors; an apartment deal cares about unit mix and comps; raw land cares about entitlement status and utility availability. Pull labels from the materials in front of you rather than copying the retail-flavored example verbatim.",
  ]},
  { section: "History & Surroundings", fields: [
    "history: { s, bullets: [{ t: \"short title\", d: \"detail\", s }] }",
    "surroundings: { s, items: [{ name, rel: \"relationship\", type: \"opp\"|\"watch\", note }] }",
  ]},
  { section: "Tenants & Contacts", fields: [
    "tenants: [{ name, logo, status, cls: \"badge-ok\"|\"badge-neutral\"|\"badge-warn\", note, s }]",
    "contacts: [{ role, name, org, detail, bg, s }]",
  ]},
  { section: "Development checklist", fields: [
    "checklist: { A: [{ item, status: \"done\"|\"prog\"|\"none\"|\"flag\", response, note, s }], B: [...], ... }",
    "Use the exact section letters and item text from the checklist template for this deal's dealType (below) — don't invent your own section titles or items. For each item: status \"done\" if the materials fully answer it, \"prog\" if partially, \"flag\" if it surfaces a problem worth calling out, \"none\"/s:\"need\" if you have nothing on it yet.",
  ]},
  { section: "Materials & Sources", fields: [
    "materials: { financingModel: [{ name, file, meta, s }], gis: [...], siteMap: [...], survey: [...], scoring: [...], other: [...] } — file is a link or filename to where the material already lives, NEVER embedded base64",
    "extras: [{ label, text, s }] — anything that doesn't fit a field above",
    "sources: [{ label, url }] — citations for web research",
    "images: { sitePlan: \"link/filename\" }",
  ]},
];
