# Triangle Deal Pipeline

An internal tool for tracking commercial real-estate deals. Each property is
one JSON document — basics, tags, scores, and every card section (snapshot,
site plan, property info, GIS, market, zoning, brokers & owners, history,
surroundings, tenants, phasing, financing, checklist, materials) — stored as
a single `JSONB` blob in Postgres (Neon). No ORM, no per-field CRUD, no extra
tables.

## Architecture

- **Storage**: one table (`properties`), one `JSONB` column (`data`). See
  `db/schema.sql`. Deal materials (PDFs, models, images) are **not** stored
  in the JSON — they live as static files under `/uploads/<id>/...` and the
  JSON references them by filename/link.
- **Schema**: `schema/property-schema.mjs` — a Zod schema with a
  `schemaVersion`. Only `id` and `name` are required; everything else is
  optional and renders as "Needs input" when missing. This same file
  generates the Claude data-entry prompt (`scripts/generate-prompt.mjs` ->
  `prompt/data-entry-prompt.md`), so the prompt and the schema can't drift
  apart.
- **Backend**: two tiny Vercel serverless functions —
  `api/properties/index.js` (GET list, POST validate/upsert) and
  `api/properties/[id].js` (GET one). Writes require a shared passcode
  (`PASSCODE` env var, sent as the `x-passcode` header).
- **Frontend**: `index.html` — unchanged design/CSS/scoring engine, now
  fetching from `/api/properties` instead of a hardcoded array. Weighted
  scores and financing metrics are still computed client-side from the raw
  per-factor inputs in the JSON — the DB stores inputs, not derived totals.
- **Adding a property**: Portfolio -> Add Property has two steps: (1) copy
  the generated data-entry prompt and run it in your own Claude alongside
  the deal materials, (2) paste or upload the resulting JSON — it's
  validated against the schema, previewed, then saved (upsert by `id`).
- **Editing**: every card has a "View/edit JSON" button — raw JSON with
  copy/download, or paste a corrected version back in to save. No per-field
  edit forms.

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

| Var            | Where           | Purpose                                    |
|----------------|-----------------|---------------------------------------------|
| `DATABASE_URL` | Vercel + local  | Neon Postgres connection string             |
| `PASSCODE`     | Vercel + local  | Shared passcode guarding write endpoints    |

Set both as Vercel Project Environment Variables for the deployed site; for
local dev, export them in your shell (see `.env.example`).

## Local dev

```bash
npm install
export DATABASE_URL=...   # any Postgres, including a local one for testing
export PASSCODE=...
npm run db:setup
npm run db:seed
npm run dev                # http://localhost:3000
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
