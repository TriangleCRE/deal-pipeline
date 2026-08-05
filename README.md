# Triangle Deal Pipeline

An internal, **private** tool for tracking commercial real-estate deals.
Each property is one JSON document — basics, tags, scores, and every card
section (snapshot, site plan, property info, GIS, market, zoning, brokers &
owners, history, surroundings, tenants, phasing, financing, checklist,
materials) — stored as a single `JSONB` blob in Postgres (Neon). No ORM, no
per-field CRUD, no extra tables.

## Architecture

- **Storage**: `properties` (`id`, one `JSONB` column `data`) and
  `material_files` (`id`, `property_id`, `filename`, `content_type`, a
  `bytea` `data`). See `db/schema.sql`. Deal materials (PDFs, models,
  images) are **not** stored in the `properties` JSON — the JSON only ever
  has a `file` URL, never embedded bytes. That URL points at one of two
  places: a file uploaded through the "Deal Materials" section / the
  financing-model button, served back from `material_files` via
  `GET /api/materials/file/:id/:name` (routes/materials.js); or a small
  set of seed files checked into git under `/uploads/<id>/...` (baked into
  the Vercel deployment at build time — see `vercel.json`'s
  `includeFiles`) for properties set up before in-app upload existed, or
  anywhere else with a shareable link (Drive, Dropbox, SharePoint, etc.).
  A card's `properties.data` is a few hundred KB of text at most, nowhere
  near Postgres's ~255MB jsonb limit; uploaded files are capped at 3MB
  each (`MAX_FILE_BYTES` in routes/materials.js).
- **Schema**: `schema/property-schema.mjs` — a Zod schema with a
  `schemaVersion`. Only `id` and `name` are required; everything else is
  optional and renders as "Needs input" when missing. Unknown extra fields
  are allowed (`.passthrough()`), not rejected. This same file generates the
  Claude data-entry prompt (`scripts/generate-prompt.mjs` ->
  `prompt/data-entry-prompt.md`), so the prompt and the schema can't drift
  apart.
- **Rendering order**: Postgres's `jsonb` does not preserve object key
  order. The renderer never iterates `Object.keys()`/`Object.values()` on
  stored data to decide section/field order — section order, checklist
  section order, score-criteria order, and material-category order all come
  from fixed arrays in the app's scoring/checklist engine, not from the
  JSON's key order. Arrays inside the JSON (tags, flags, checklist items,
  etc.) do preserve order, since jsonb only reorders object keys.
- **Backend**: a single small Express app (`server.js`), deployed as one
  Vercel serverless function (`vercel.json` routes every path to it). It
  handles the login screen, the passcode gate, `/robots.txt`, the
  `/api/properties` routes (`routes/properties.js`), the
  `/api/materials` upload/download routes (`routes/materials.js`), and
  serving `index.html` / `/uploads` / `/prompt`.
- **Privacy** (see below) — the whole site sits behind one shared passcode.
  There's no separate "write" passcode anymore: being logged in *is* the
  authorization to read or write.
- **Frontend**: `index.html` — unchanged design/CSS/scoring engine, fetching
  from `/api/properties`. Weighted scores and financing metrics are
  computed client-side from the raw per-factor inputs in the JSON — the DB
  stores inputs, not derived totals.
- **Adding a property**: Portfolio -> Add Property is two steps: (1) copy
  the generated data-entry prompt, paste it into your own Claude, and
  upload/attach everything you have on the property there — GIS, survey,
  financial model, photos, notes, whatever exists (partial is fine; the
  page has a collapsed "see examples" list for anyone unsure what to
  gather), (2) paste or upload the JSON Claude gives back — it's validated
  against the schema, previewed, then saved (upsert by `id`), and lands you
  straight on the new card. Materials themselves aren't part of that JSON
  upload — once the card exists (right there after step 2, or any time
  later), use the "Deal Materials" section (or the financing-model button)
  to upload the actual files (max 3MB each); for anything bigger, paste a
  link to where it already lives (Drive, Dropbox, SharePoint, etc.) via
  View/edit JSON instead.
- **Concept Site Plan image**: the big rendered site-plan image (as opposed
  to a downloadable site-plan file in Deal Materials) lives at
  `images.sitePlan` and is uploaded the same "real control if there's
  something to show, upload prompt otherwise" way as the financing model —
  from the card's Edit mode, no separate flow to remember: with nothing
  uploaded yet it's an "＋ Upload site plan image" prompt, and once one
  exists it's "＋ Replace site plan image". Works identically for a
  brand-new property (Edit mode is available immediately after Add Property
  lands you on the new card) and for a property that's had one for years.
  Uses the same upload endpoint/size cap as Deal Materials
  (`POST /api/materials/:propertyId` with `imageKey` instead of `category` —
  see routes/materials.js), just writing to `images.sitePlan` instead of
  appending to a `materials[category]` list.
- **Editing**: every card has an "✎ Edit card" button for editing existing
  text/values in place (name, thesis, scores, flags, tenants, contacts,
  checklist responses, etc.) — Save writes the whole document back through
  the same upsert endpoint, so it's visible to every Triangle employee, not
  just the browser that made the edit. Adding or removing a row (a new
  tenant, a new checklist item) is out of scope for inline editing — use
  the "View/edit JSON" button for that: raw JSON with copy/download, or
  paste a corrected version back in to save.
- **Created / last-edited dates**: tracked by the `properties` row itself
  (`created_at`/`updated_at` in `db/schema.sql`), not hand-typed — every
  save bumps `updated_at`; `created_at` is set once, on the row's first
  insert, and never touched again. `lib/db.mjs` surfaces them to the
  frontend as plain `createdAt`/`updatedAt` fields on the property object
  (same shape as `archivedAt`), which is what the property page's Deal meta
  block ("Added" / "Last edited") reads from — portfolio grid cards don't
  show either date. Distinct from the older, free-text `updated` field (a
  hand-typed "as of" note like "Q3 2026 broker call") — that one's still
  there, unchanged, and still editable.
- **Archiving vs. deleting**: "🗄 Archive" on a card sets `archived` in its
  JSON (no separate page/table) — an archived property is kept intact and
  stays on the portfolio grid, just sorted to the bottom and grayed out,
  and drops out of the KPIs and status/type filters until "↩ Restore".
  "🗑 Delete" is the only destructive action in the app — it permanently
  removes the row (and its uploaded material files, via `on delete
  cascade`) after a confirm dialog; there's no undo.

## Privacy — how it's kept off Google and every crawler

Three layers, per the brief:

1. **The passcode wall (the layer that actually enforces privacy).**
   `lib/auth.mjs` implements a signed session cookie: `POST /api/login`
   checks the passcode against `PASSCODE` and sets an HMAC-signed,
   `HttpOnly`/`SameSite=Lax` cookie (`Secure` too, whenever the request is
   over HTTPS). `server.js` runs one `authGate` middleware **before every
   route** — static files, the SPA shell, and every `/api/*` call. No valid
   cookie -> you get the login screen (HTML) or a `401 {"error":...}` JSON
   body for API calls; nothing else is ever served. The only paths exempt
   from the gate are `/login`, `/api/login`, `/api/logout`, and
   `/robots.txt` (crawlers need to be able to fetch the last one). There
   are no user accounts or roles — one passcode, one session, done.
2. **`X-Robots-Tag: noindex, nofollow, noarchive` on every response.** Set
   by the very first middleware in `server.js`, before routing, before the
   auth gate — so it's on the login page, every API response, 401s, 404s,
   and the final error handler alike.
3. **`/robots.txt`** (served publicly, un-gated) disallows every path for
   every user agent, plus explicit entries for GPTBot, ChatGPT-User,
   ClaudeBot, anthropic-ai, CCBot, PerplexityBot, Google-Extended, and
   Bytespider. This is politeness only — layer 1 is what actually keeps
   this private, since robots.txt can't stop a crawler that ignores it, and
   blocked URLs can still get indexed from external links.

Also: no sitemap, no third-party analytics, and don't post this URL
anywhere public.

## One-time setup (Neon)

1. Create a Neon project/database, grab its connection string.
2. Run the SQL in `db/schema.sql` in full (paste into the Neon SQL editor,
   or run `npm run db:setup` locally with `DATABASE_URL` set) — it creates
   `properties` and `material_files`. Safe to re-run any time the file
   changes (every statement in it is a no-op against an already-current
   database), which is also how an existing database picks up a schema
   change like `created_at` — no separate migration step or tool.
3. Seed the 6968 Seminole Trail card (extracted from the old index.html,
   already validated against the schema):

   ```bash
   DATABASE_URL=... npm run db:seed
   ```

## Env vars

| Var            | Where           | Purpose                                              |
|----------------|-----------------|-------------------------------------------------------|
| `DATABASE_URL` | Vercel + local  | Neon Postgres connection string                       |
| `PASSCODE`     | Vercel + local  | The one shared passcode — site login + cookie signing |

Set both as Vercel Project Environment Variables for the deployed site; for
local dev, export them in your shell (see `.env.example`). Vercel's own
Deployment Protection can be layered on top if you want it, but the app-level
gate above is required either way — privacy shouldn't depend on the host.

## Local dev

```bash
npm install
export DATABASE_URL=...   # any Postgres, including a local one for testing
export PASSCODE=...
npm run db:setup
npm run db:seed
npm run dev                # http://localhost:3000 — same server.js Vercel runs
```

## Regenerating the data-entry prompt

If you change `schema/property-schema.mjs` (add/rename a field), regenerate
the prompt so it stays in sync:

```bash
npm run gen:prompt
```

## Migration note

`scripts/extract-legacy-data.mjs` is the one-time script that pulled the
property data and embedded base64 files out of the old monolithic
`index.html` into `data/seed/*.json` + `uploads/*`. It's kept for provenance
but isn't part of normal operation.
