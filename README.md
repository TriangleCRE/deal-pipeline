# Triangle Deal Pipeline

An internal, **private** tool for tracking commercial real-estate deals.
Each property is one JSON document — basics, tags, scores, and every card
section (snapshot, site plan, property info, GIS, market, zoning, brokers &
owners, history, surroundings, tenants, phasing, financing, checklist,
materials) — stored as a single `JSONB` blob in Postgres (Neon). No ORM, no
per-field CRUD, no extra tables.

## Architecture

- **Storage**: one table (`properties`), one `JSONB` column (`data`). See
  `db/schema.sql`. Deal materials (PDFs, models, images) are **not** stored
  in the JSON — they live as static files under `/uploads/<id>/...` and the
  JSON references them by filename/link. A card is a few hundred KB of text
  at most, nowhere near Postgres's ~255MB jsonb limit.
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
  `/api/properties` routes (`routes/properties.js`), and serving
  `index.html` / `/uploads` / `/prompt`.
- **Privacy** (see below) — the whole site sits behind one shared passcode.
  There's no separate "write" passcode anymore: being logged in *is* the
  authorization to read or write.
- **Frontend**: `index.html` — unchanged design/CSS/scoring engine, fetching
  from `/api/properties`. Weighted scores and financing metrics are
  computed client-side from the raw per-factor inputs in the JSON — the DB
  stores inputs, not derived totals.
- **Adding a property**: Portfolio -> Add Property walks through three
  steps: (1) gather whatever deal materials exist (the page lists examples —
  OM, survey, GIS card, site plan, financial model, rent roll, etc. —
  partial is fine), (2) copy the generated data-entry prompt into your own
  Claude conversation and paste/attach everything from step 1 there, (3)
  paste or upload the JSON Claude gives back — it's validated against the
  schema, previewed, then saved (upsert by `id`). Materials themselves never
  get uploaded to this app; only the resulting JSON does. If you want
  working file links on a card, the source files need to already be
  somewhere with a shareable link (Drive, Dropbox, SharePoint, etc.) so
  Claude can include the link in the JSON — this app doesn't host files.
- **Editing**: every card has a "View/edit JSON" button — raw JSON with
  copy/download, or paste a corrected version back in to save. No per-field
  edit forms.

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
2. Run the SQL in `db/schema.sql` (paste into the Neon SQL editor, or run
   `npm run db:setup` locally with `DATABASE_URL` set):

   ```sql
   create table if not exists properties (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );

   create index if not exists properties_updated_at_idx on properties (updated_at desc);
   ```

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
