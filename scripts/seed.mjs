// Upserts every JSON file in data/seed/ into the properties table.
// Run with: DATABASE_URL=... npm run db:seed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProperty } from "../schema/property-schema.mjs";
import { upsertProperty, getPool } from "../lib/db.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedDir = path.join(ROOT, "data", "seed");

const files = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));
if (!files.length) {
  console.log("No seed files in data/seed/.");
  process.exit(0);
}

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(seedDir, file), "utf8"));
  const check = validateProperty(raw);
  if (!check.ok) {
    console.error(`${file}: schema validation failed:`);
    check.errors.forEach((e) => console.error(`  ${e.path}: ${e.message}`));
    process.exitCode = 1;
    continue;
  }
  await upsertProperty(check.data.id, check.data);
  console.log(`seeded ${check.data.id} (${file})`);
}

await getPool().end();
