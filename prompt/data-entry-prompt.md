<!--
  GENERATED FILE — do not hand-edit. Regenerate with:
    npm run gen:prompt
  Source of truth: schema/property-schema.mjs (SCHEMA_VERSION, FIELD_GUIDE,
  SCORE_CRITERIA_BY_TYPE, CHECKLIST_TEMPLATE_BY_TYPE)
-->
# Deal data-entry prompt (schema v1)

Paste this whole prompt into your own Claude, along with the deal materials
for one property (offering memorandum, survey, financial model, notes,
emails, etc.), then paste Claude's JSON output into the "Upload JSON" box on
the Deal Pipeline page.

---

You are filling out ONE structured JSON document describing a commercial
real-estate deal for Triangle Investment Group's deal pipeline tool. You will
be given deal materials (an offering memorandum, survey, financial model,
notes, emails, etc.) for a property that could be *any* asset class — retail,
industrial, multifamily, office, land, mixed-use, self-storage, whatever this
particular deal actually is. Read the materials carefully and produce a
single JSON object matching the schema below, adapted to what this deal
actually is — not forced into the shape of the retail example just because
it's an example.

Rules:
1. This deal could be any property type. The two example documents below
   show two different shapes (a retail+storage site, an industrial
   build-to-suit) on purpose — they illustrate the STRUCTURE, not a fixed
   vocabulary. Field names inside `financing`, and labels inside
   `propertyInfo`/`gis`/`market`/`zoning`/`hbu`, are free-form — use
   whatever actually describes this deal's model and materials. The
   `scores` keys and `checklist` sections/items, however, are NOT
   free-form — use exactly the ones listed for this deal's `dealType` in
   the reference tables below.
2. Don't just transcribe the materials — actively fill out the card:
   - If you have web/browsing access, look up publicly available
     information the materials don't cover (demographics, traffic counts,
     nearby tenants/comps, zoning ordinance text, market trends) and tag it
     "web" with a citation added to `sources`.
   - Where the materials and web research both fall short but you can make
     a reasoned, professional judgment (an investment thesis, highest & best
     use, phasing strategy, a score's rationale, a risk read), give your
     best estimate and tag it "ai" — say what it's based on (or its caveat)
     in a note.
   - Reserve "need" for things you have no reasonable basis to infer or
     estimate at all (e.g. a specific negotiated price, a contact's direct
     phone number) — don't reach for "need" just because a fact isn't
     stated verbatim in the materials if you can reasonably work it out.
   - If you don't have live web access in this conversation, that's fine —
     just do the best you can with the materials and reasoning, and don't
     fabricate a citation you can't actually verify.
3. Every fact that has a value must be tagged with the source it came from,
   using the `s` (or `d.s`) property, one of:
   - "source" — directly from the attached deal materials (GIS, survey,
     financing model, email, notes)
   - "web"    — you looked it up online; cite it in a "sources" entry
   - "ai"     — your own estimate or inference; say what it's based on
   - "need"   — you don't know it and can't reasonably infer it; DO NOT
     GUESS, mark it "need" instead
4. Never invent numbers, contacts, or citations. If you're not confident,
   use "ai" and say so in a note, or use "need" and leave it blank.
5. Never embed file contents (no base64, no data: URIs). For `materials`,
   `sources`, `images`, and any logo, reference the file by its filename
   or link only — wherever the actual file already lives. If a file only
   exists locally with no shareable link, note that in `meta` and give it
   a plain filename rather than a broken link.
6. `scores` are raw 1-5 inputs per factor — never compute or send a total
   score; the app computes the weighted score itself.
7. `id` should be a short, lowercase, hyphenated slug derived from the
   property name/address (e.g. "6968-seminole-trail").
8. Fill in every field the materials, web research, or your own reasoning
   support (per rule 2). If a field still isn't supported, either omit it
   or set its value to null — the app renders missing fields as "Needs
   input." Don't delete a key entirely if the shape expects an
   object/array; just leave it thin.
9. Output ONLY the JSON object. No commentary, no markdown code fence, no
   explanation before or after it.

## Score factors by deal type

Pick `dealType` based on how the deal originated — Property-Driven if you
started with a site and are figuring out highest & best use / who to put in
it; Tenant-Driven if a tenant's requirements are driving the search for a
site. Then score ONLY that type's factors (1-5 each):

**Property-Driven** (weights sum to 14.5):
- `location` — Location Quality (weight 2) — 5 = dominant corridor / hard corner · 3 = workable · 1 = weak
- `traffic` — Traffic (weight 1.5) — 5 = very high AADT / visibility · 1 = low counts
- `demographics` — Demographics (weight 1.25) — 5 = strong income + growth + density · 1 = weak
- `zoning` — Zoning Risk (weight 1.5) — 5 = by-right / very low risk · 3 = moderate approval risk · 1 = rezoning / political risk
- `siteLayout` — Site Layout Efficiency (weight 1.25) — 5 = highly efficient fit · 1 = constrained / poor yield
- `tenantDemand` — Tenant Demand (weight 2) — 5 = deep demand / signed interest · 1 = limited demand
- `rentPotential` — Rent Potential (weight 2) — 5 = materially above target · 3 = at target · 1 = below
- `devCost` — Development Cost Risk (weight 1.5) — 5 = low / predictable cost · 1 = high / uncertain cost
- `exitLiquidity` — Exit Liquidity (weight 1.5) — 5 = broad buyer pool / easy exit · 1 = thin buyer pool

**Tenant-Driven** (weights sum to 13):
- `tenantFit` — Tenant Requirement Fit (weight 2) — 5 = site matches all tenant criteria · 3 = workable with tradeoffs · 1 = major gaps
- `tradeArea` — Trade Area Strength (weight 1.5) — 5 = dominant corridor, thin competition · 1 = weak / saturated
- `siteAvailability` — Site Availability (weight 1.25) — 5 = multiple viable sites identified · 1 = few or no options
- `siteFeasibility` — Site-Level Feasibility (weight 1.5) — 5 = clean access/utilities/zoning · 1 = major constraints
- `tenantCommitment` — Tenant Commitment (weight 2) — 5 = LOI signed, economics aligned · 1 = exploratory only
- `dealEconomics` — Deal Economics (weight 2) — 5 = yield on cost well above target · 3 = at target · 1 = below
- `entitlementRisk` — Entitlement & Timeline Risk (weight 1.5) — 5 = by-right, fast timeline · 1 = rezoning/SUP required, slow
- `executionReadiness` — Execution Readiness (weight 1.25) — 5 = site control secured, budget final · 1 = early stage

## Development checklist by deal type

Use the exact section letters and item text below for this deal's
`dealType` — these are fixed, unlike the free-form fields elsewhere:

**Property-Driven** (sections A–I):
- **A. Property Information**: Address, parcel ID · Acreage · Ownership structure · Asking price / basis · Current zoning · Existing improvements · Utilities status
- **B. Market & Location Analysis**: Traffic counts · Visibility · Retail corridor strength · Nearby anchors · Competition mapping · Demographics · Growth trends · Daytime population
- **C. Highest & Best Use**: Single-tenant net lease · Multi-tenant strip center · Mixed-use potential · Pad development strategy · Phasing potential
- **D. Site Planning Test Fit**: Building footprints · Parking layout · Drive-thru feasibility · Truck access · Stormwater requirements
- **E. Entitlement & Risk**: Zoning compliance · Rezoning required · Political risk · Planning timeline · Municipal constraints
- **F. Deal Economics**: Land basis · Development cost · Rent assumptions · Stabilized NOI · Exit value · Yield on cost · Sensitivity analysis
- **G. Tenant Targeting**: Identify tenant categories · Build tenant list · Match tenants to layout
- **H. Tenant Outreach**: Create site package · Broker outreach · Direct outreach · Track feedback · Iterate site plan · Secure LOIs
- **I. Deal Execution**: Pre-lease thresholds · Finalize site plan · Secure financing · Execute leases · Begin construction

**Tenant-Driven** (sections A–G):
- **A. Tenant Requirement Definition**: Confirm tenant type (Ground lease / BTS / inline) · Required building size (SF range) · Site size requirement (acres) · Parking requirements · Drive-thru requirements · Visibility requirements · Traffic count thresholds · Demographic requirements · Co-tenancy preferences · Prohibited adjacencies · Market priority ranking · Timeline · Prototype / site plan requirements
- **B. Market Mapping & Trade Area Identification**: Define target trade areas · Map competitor locations · Identify gaps / white space · Identify dominant retail corridors · Rank corridors · Confirm traffic counts · Identify anchor centers
- **C. Site Identification**: Vacant land parcels · Redevelopment opportunities · Outparcels · Assemblage opportunities · Broker outreach · Off-market outreach · Public land opportunities · Ground lease opportunities
- **D. Site-Level Feasibility**: Parcel size & dimensions · Topography · Access / ingress-egress · Visibility · Utilities availability · Environmental concerns · Floodplain / wetlands · Zoning compliance · Drive-thru allowance · Parking compliance · Setbacks / height · Signage limitations · Rezoning or SUP required
- **E. Deal Economics**: Land cost · Construction cost · Soft costs · Tenant rent · Yield on cost · Exit cap rate · Developer fee · Available incentives
- **F. Tenant Engagement**: Present site options · Gather feedback · Secure LOI · Confirm lease economics · Align on site plan
- **G. Site Control & Execution**: Secure PSA / ground lease · Negotiate contingencies · Begin entitlements · Execute lease · Finalize budget · Move to financing and construction

## Schema (schemaVersion 1)

Only `id` and `name` are required. Everything else is optional — a
missing section just renders as "Needs input."

### Basics
- id — url slug, e.g. "6968-seminole-trail" (lowercase, hyphenated)
- name, address, county, parcels, status (pipeline stage, e.g. "Under Review")
- dealType — "Property-Driven" or "Tenant-Driven"
- tags — array of short strings
- updated — YYYY-MM-DD
- headlineTenant: { name, logo } — logo is a link/filename, never base64
- meta: { dealId, entity, prepared, sourceModel }

### Investment thesis & flags
- thesis: { v: "1-3 sentence summary", s: provenance }
- flags: [{ type: "opp"|"risk"|"watch", text, s }]

### Weighted score (1-5 each factor, app computes the total)
- scoreProvenance — provenance for the score set as a whole
- scores — use the id from the score-factor table for this deal's dealType (below) as the key, 1-5 as the value. Never send a computed/weighted total — the app computes it from these raw inputs.
- scoreNotes — { <same key>: "one-line rationale" } — a short justification per factor, the same way the example does

### Financing model inputs (app computes NOI/IRR/etc.)
- financing — a free-form bag of plain numbers pulled straight from the deal's model — there is no fixed set of keys. The example below (landPrice, retailSF, retailRentPSF, storageSF, storageCostPSF, storageRentPSF, softCosts, totalProjectCost, loanLTC, loan, equity, interestRate, amortYears, holdYears, exitCap, costOfSale, stabilizedNOI, yieldOnCost, exitValue, leveredIRR, equityMultiple, cashOnCash, dscr, storageSensitivity: [{rent,yoc,spread}, ...]) is from a retail + self-storage deal — reuse whatever of those genuinely apply, but for a different asset class use whatever key names actually describe THAT model's line items (e.g. unitCount/avgUnitRentPSF for multifamily, warehouseSF/officeSF/clearHeightFt for industrial, lotCount/lotPricePerAcre for land, baseRentPSF/percentageRent for a ground lease). Match the model in front of you, don't force it into someone else's shape.
- financingNote: { pencil: {v,s}, listAsk: {v,s} } — call out if the deal does or doesn't pencil, and any price-to-reconcile note

### Property Information / GIS / Market / Zoning / Highest & Best Use
- propertyInfo, gis, market, zoning, hbu — each an array of { k: "label", d: { v: "value", s, n: "optional note" } }. The labels are free-form too — use whatever's relevant to this property's actual type. A retail corner cares about traffic counts and visibility; a warehouse cares about clear height and dock doors; an apartment deal cares about unit mix and comps; raw land cares about entitlement status and utility availability. Pull labels from the materials in front of you rather than copying the retail-flavored example verbatim.

### History & Surroundings
- history: { s, bullets: [{ t: "short title", d: "detail", s }] }
- surroundings: { s, items: [{ name, rel: "relationship", type: "opp"|"watch", note }] }

### Tenants & Contacts
- tenants: [{ name, logo, status, cls: "badge-ok"|"badge-neutral"|"badge-warn", note, s }]
- contacts: [{ role, name, org, detail, bg, s }]

### Development checklist
- checklist: { A: [{ item, status: "done"|"prog"|"none"|"flag", response, note, s }], B: [...], ... }
- Use the exact section letters and item text from the checklist template for this deal's dealType (below) — don't invent your own section titles or items. For each item: status "done" if the materials fully answer it, "prog" if partially, "flag" if it surfaces a problem worth calling out, "none"/s:"need" if you have nothing on it yet.

### Materials & Sources
- materials: { financingModel: [{ name, file, meta, s }], gis: [...], siteMap: [...], survey: [...], scoring: [...], other: [...] } — file is a link or filename to where the material already lives, NEVER embedded base64
- extras: [{ label, text, s }] — anything that doesn't fit a field above
- sources: [{ label, url }] — citations for web research
- images: { sitePlan: "link/filename" }

## Examples (trimmed — show the shape and how it adapts, not real data)

### Example 1 — Property-Driven, retail + self-storage

```json
{
  "schemaVersion": 1,
  "id": "1200-example-pkwy",
  "name": "1200 Example Pkwy",
  "address": "1200 Example Pkwy, Anytown, VA 22222",
  "county": "Anytown County, VA",
  "parcels": "TMP 12-A-3",
  "status": "Under Review",
  "dealType": "Property-Driven",
  "tags": [
    "Hard corner",
    "Retail + Self-Storage"
  ],
  "updated": "2026-08-04",
  "headlineTenant": {
    "name": "Example Retailer",
    "logo": null
  },
  "meta": {
    "dealId": "TRI-2026-002",
    "entity": "Triangle Investment Group",
    "prepared": "S. Dahl · Aug 2026",
    "sourceModel": "Example Financial Model v1"
  },
  "thesis": {
    "v": "Signalized hard corner with an interested anchor tenant; rezoning is the key risk.",
    "s": "ai"
  },
  "flags": [
    {
      "type": "opp",
      "text": "Anchor tenant has expressed interest.",
      "s": "source"
    },
    {
      "type": "risk",
      "text": "Requires rezoning from residential to commercial.",
      "s": "source"
    }
  ],
  "scoreProvenance": "ai",
  "scores": {
    "location": 4,
    "traffic": 4,
    "demographics": 3,
    "zoning": 2,
    "siteLayout": 4,
    "tenantDemand": 3,
    "rentPotential": 3,
    "devCost": 3,
    "exitLiquidity": 3
  },
  "scoreNotes": {
    "location": "Hard corner on a major arterial.",
    "zoning": "Rezoning required, not guaranteed."
  },
  "financing": {
    "landPrice": 1000000,
    "retailSF": 6000,
    "retailRentPSF": 26,
    "totalProjectCost": 5000000,
    "loanLTC": 0.7,
    "exitCap": 0.075
  },
  "financingNote": {
    "pencil": {
      "v": "Pencils at current assumptions.",
      "s": "ai"
    }
  },
  "propertyInfo": [
    {
      "k": "Address",
      "d": {
        "v": "1200 Example Pkwy",
        "s": "source"
      }
    },
    {
      "k": "Current zoning",
      "d": {
        "v": "R-1 — requires rezoning to commercial",
        "s": "source"
      }
    }
  ],
  "gis": [
    {
      "k": "Frontage",
      "d": {
        "v": "±400 ft on Example Pkwy",
        "s": "source"
      }
    }
  ],
  "market": [
    {
      "k": "Traffic (AADT)",
      "d": {
        "v": "≈18,000 vehicles/day",
        "s": "web",
        "n": "State DOT count, 2025."
      }
    }
  ],
  "zoning": [
    {
      "k": "Current → target",
      "d": {
        "v": "R-1 → B-2",
        "s": "source"
      }
    }
  ],
  "hbu": [
    {
      "k": "Primary use",
      "d": {
        "v": "Single-tenant retail anchor",
        "s": "ai"
      }
    }
  ],
  "history": {
    "s": "source",
    "bullets": [
      {
        "t": "Owner motivated",
        "d": "Seller wants to close quickly.",
        "s": "source"
      }
    ]
  },
  "surroundings": {
    "s": "web",
    "items": [
      {
        "name": "Example Grocery (adjacent)",
        "rel": "Adjacent, shared curb cut",
        "type": "opp",
        "note": "Drives cross-shopping traffic."
      }
    ]
  },
  "tenants": [
    {
      "name": "Example Retailer",
      "logo": null,
      "status": "Interested — anchor",
      "cls": "badge-ok",
      "note": "LOI in progress.",
      "s": "source"
    }
  ],
  "contacts": [
    {
      "role": "Listing Broker",
      "name": "Jane Broker",
      "org": "Example Realty",
      "detail": "jane@example.com",
      "s": "source"
    }
  ],
  "checklist": {
    "A": [
      {
        "item": "Address, parcel ID",
        "status": "done",
        "response": "1200 Example Pkwy; TMP 12-A-3",
        "s": "source"
      }
    ]
  },
  "materials": {
    "financingModel": [
      {
        "name": "Example Financial Model v1",
        "file": "uploads/1200-example-pkwy/example-model.xlsx",
        "meta": "Base case",
        "s": "source"
      }
    ]
  },
  "extras": [
    {
      "label": "Regional context",
      "text": "20 minutes from the county seat.",
      "s": "source"
    }
  ],
  "sources": [
    {
      "label": "County GIS parcel viewer",
      "url": "https://example-county.gov/gis"
    }
  ],
  "images": {
    "sitePlan": "uploads/1200-example-pkwy/site-plan.svg"
  }
}
```

### Example 2 — Tenant-Driven, industrial build-to-suit

Notice `scores`/`checklist` use the Tenant-Driven tables above, and
`financing`/`propertyInfo`/`market` use industrial-specific field
names and labels instead of the retail example's — that's the adaptation
rule 1 is asking for.

```json
{
  "schemaVersion": 1,
  "id": "4400-commerce-blvd",
  "name": "4400 Commerce Blvd (BTS)",
  "address": "4400 Commerce Blvd, Example City, VA 24000",
  "county": "Example County, VA",
  "status": "LOI / Negotiation",
  "dealType": "Tenant-Driven",
  "tags": [
    "Build-to-suit",
    "Industrial",
    "I-81 corridor"
  ],
  "updated": "2026-08-04",
  "headlineTenant": {
    "name": "Example Logistics Co.",
    "logo": null
  },
  "thesis": {
    "v": "A regional 3PL needs a 120K SF distribution building on I-81; this site fits their footprint and timeline.",
    "s": "ai"
  },
  "scoreProvenance": "ai",
  "scores": {
    "tenantFit": 4,
    "tradeArea": 3,
    "siteAvailability": 3,
    "siteFeasibility": 4,
    "tenantCommitment": 3,
    "dealEconomics": 4,
    "entitlementRisk": 4,
    "executionReadiness": 3
  },
  "scoreNotes": {
    "tenantFit": "Site depth and clear-height requirement both check out.",
    "tenantCommitment": "LOI signed, lease terms still being negotiated."
  },
  "financing": {
    "landPrice": 2200000,
    "warehouseSF": 120000,
    "clearHeightFt": 32,
    "dockDoors": 24,
    "baseRentPSF": 6.25,
    "escalationPct": 0.03,
    "totalProjectCost": 14500000,
    "loanLTC": 0.65
  },
  "propertyInfo": [
    {
      "k": "Parcel size",
      "d": {
        "v": "±22 acres",
        "s": "source"
      }
    },
    {
      "k": "Zoning",
      "d": {
        "v": "M-1 (Light Industrial) — by right",
        "s": "source"
      }
    }
  ],
  "market": [
    {
      "k": "Highway access",
      "d": {
        "v": "Direct frontage on I-81 Exit 12",
        "s": "source"
      }
    }
  ],
  "checklist": {
    "A": [
      {
        "item": "Confirm tenant type (Ground lease / BTS / inline)",
        "status": "done",
        "response": "Build-to-suit, 120K SF",
        "s": "source"
      }
    ]
  },
  "materials": {
    "survey": [
      {
        "name": "ALTA Survey",
        "file": "uploads/4400-commerce-blvd/alta-survey.pdf",
        "s": "source"
      }
    ]
  },
  "sources": [
    {
      "label": "County zoning ordinance — M-1 district",
      "url": "https://example-county.gov/zoning/m1"
    }
  ]
}
```
