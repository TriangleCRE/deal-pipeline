// Creates the `properties` table. Safe to re-run (uses `create table if not
// exists`). Run with: DATABASE_URL=... npm run db:setup
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../lib/db.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sql = fs.readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8");

const pool = getPool();
await pool.query(sql);
console.log("properties table ready.");
await pool.end();
