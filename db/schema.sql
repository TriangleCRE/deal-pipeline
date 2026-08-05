-- Triangle Deal Pipeline — storage schema.
-- One table, one JSONB column. One property = one row. No ORM, no migration
-- framework — this is the whole schema. Run it once against your Neon
-- database (via `npm run db:setup`, or paste it into the Neon SQL editor).

create table if not exists properties (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- created_at was added after properties already existed in some databases
-- (including production) — `create table if not exists` above is a no-op
-- there, so backfill it explicitly. Safe to re-run: a no-op once the column
-- exists. Existing rows get created_at = their current updated_at (the best
-- available approximation of when they were first added, since that's all
-- the old schema tracked); new rows get the DEFAULT now() from here on.
alter table properties add column if not exists created_at timestamptz;
update properties set created_at = updated_at where created_at is null;
alter table properties alter column created_at set default now();
alter table properties alter column created_at set not null;

-- Speeds up "list sorted by most recently updated" on the portfolio page.
create index if not exists properties_updated_at_idx on properties (updated_at desc);

-- Deal material file bytes (financing models, surveys, GIS cards, ...),
-- uploaded via the "Deal Materials" section / the financing-model button.
-- A property JSON's materials[category][].file field just holds the URL
-- this table is served back through (/api/materials/:id/:filename) — the
-- schema's "link/filename only, never base64 in the JSON" rule still
-- holds; the bytes live here, not in the properties.data blob. Vercel's
-- serverless functions have no persistent local disk to write an actual
-- uploaded file to (unlike the git-committed uploads/ folder, which is
-- baked into the deployment at build time), so Postgres — already the
-- only piece of infra this app needs — is what makes a real upload button
-- possible without adding a separate file-storage service.
create table if not exists material_files (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  filename text not null,
  content_type text,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists material_files_property_id_idx on material_files (property_id);
