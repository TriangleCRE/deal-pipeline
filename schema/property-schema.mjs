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

/**
 * Validate a candidate property document.
 * Returns { ok: true, data } or { ok: false, errors: [{ path, message }] }.
 * Never throws.
 */
export function validateProperty(candidate) {
  const result = PropertySchema.safeParse(candidate);
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
    "scores — Property-Driven keys: location, traffic, demographics, zoning, siteLayout, tenantDemand, rentPotential, devCost, exitLiquidity",
    "scores — Tenant-Driven keys: tenantFit, tradeArea, siteAvailability, siteFeasibility, tenantCommitment, dealEconomics, entitlementRisk, executionReadiness",
    "scoreNotes — { <same key>: \"one-line rationale\" }",
  ]},
  { section: "Financing model inputs (app computes NOI/IRR/etc.)", fields: [
    "financing — plain numbers pulled straight from the model, e.g. landPrice, retailSF, retailRentPSF, retailCostPSF, storageSF, storageCostPSF, storageRentPSF, softCosts, totalProjectCost, loanLTC, loan, equity, interestRate, amortYears, holdYears, exitCap, costOfSale, retailNOI, storageNOI, stabilizedNOI, yieldOnCost, devSpread, exitValue, netSaleValue, devProfit, profitMarginOnCost, leveredIRR, equityMultiple, cashOnCash, dscr, annualDebtService, loanBalanceExit, storageSensitivity: [{rent,yoc,spread}, ...]",
    "financingNote: { pencil: {v,s}, listAsk: {v,s} } — call out if the deal does or doesn't pencil, and any price-to-reconcile note",
  ]},
  { section: "Property Information / GIS / Market / Zoning / Highest & Best Use", fields: [
    "propertyInfo, gis, market, zoning, hbu — each an array of { k: \"label\", d: { v: \"value\", s, n: \"optional note\" } }",
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
    "Use the section letters/items for the deal's dealType (see the app's checklist templates) — leave status \"none\" and s \"need\" for anything not yet worked.",
  ]},
  { section: "Materials & Sources", fields: [
    "materials: { financingModel: [{ name, file, meta, s }], gis: [...], siteMap: [...], survey: [...], scoring: [...], other: [...] } — file is a link or filename to where the material already lives, NEVER embedded base64",
    "extras: [{ label, text, s }] — anything that doesn't fit a field above",
    "sources: [{ label, url }] — citations for web research",
    "images: { sitePlan: \"link/filename\" }",
  ]},
];
