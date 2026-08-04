// Shared DB helper. Deliberately not a connection pool — this is a
// low-traffic internal tool (Neon's free plan is plenty), and the brief
// asks for no pooling infrastructure on top of Neon. Each call opens a
// short-lived `pg` client, runs its query, and closes it. Works against
// Neon (standard Postgres wire protocol, sslmode=require) or any plain
// Postgres, including localhost for dev/testing.
import pg from "pg";

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new pg.Client({
    connectionString,
    ssl: /neon\.tech|sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false,
  });
}

async function withClient(fn) {
  const client = makeClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function listProperties() {
  return withClient(async (client) => {
    const { rows } = await client.query(
      "select data from properties order by updated_at desc"
    );
    return rows.map((r) => r.data);
  });
}

export async function getProperty(id) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      "select data from properties where id = $1",
      [id]
    );
    return rows[0]?.data ?? null;
  });
}

// Upsert by id — re-saving the same id updates the existing row.
export async function upsertProperty(id, data) {
  return withClient(async (client) => {
    await client.query(
      `insert into properties (id, data, updated_at)
       values ($1, $2, now())
       on conflict (id) do update set data = $2, updated_at = now()`,
      [id, data]
    );
  });
}

// Runs arbitrary SQL (used by scripts/setup-db.mjs to apply db/schema.sql).
export async function runSql(sql) {
  return withClient((client) => client.query(sql));
}
