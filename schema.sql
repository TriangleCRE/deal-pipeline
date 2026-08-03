-- Run this once against the Neon database before the API endpoints will work.
-- (Neon SQL editor, or: psql "$DATABASE_URL" -f schema.sql)

create table if not exists property_edits (
  property_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists new_properties (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
