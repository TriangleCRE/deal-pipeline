// Shared DB helper — a single `pg` Pool, reused across API routes and
// scripts. Works with any Postgres connection string, including Neon's.
import pg from "pg";

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({
      connectionString,
      // Neon requires TLS; sslmode=require in the connection string handles
      // this too, but be explicit so local Postgres (no TLS) still works
      // when the connection string has no sslmode param.
      ssl: /neon\.tech|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return pool;
}

export async function listProperties() {
  const { rows } = await getPool().query(
    "select data from properties order by updated_at desc"
  );
  return rows.map((r) => r.data);
}

export async function getProperty(id) {
  const { rows } = await getPool().query(
    "select data from properties where id = $1",
    [id]
  );
  return rows[0]?.data ?? null;
}

// Upsert by id — re-saving the same id updates the existing row.
export async function upsertProperty(id, data) {
  await getPool().query(
    `insert into properties (id, data, updated_at)
     values ($1, $2, now())
     on conflict (id) do update set data = $2, updated_at = now()`,
    [id, data]
  );
}
