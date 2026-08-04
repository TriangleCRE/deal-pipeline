-- Triangle Deal Pipeline — storage schema.
-- One table, one JSONB column. One property = one row. No ORM, no migration
-- framework — this is the whole schema. Run it once against your Neon
-- database (via `npm run db:setup`, or paste it into the Neon SQL editor).

create table if not exists properties (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Speeds up "list sorted by most recently updated" on the portfolio page.
create index if not exists properties_updated_at_idx on properties (updated_at desc);
