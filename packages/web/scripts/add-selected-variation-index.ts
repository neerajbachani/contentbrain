/**
 * Safe one-time migration: add selected_variation_index without truncating remixes.
 * Run: bun --env-file=../../.env scripts/add-selected-variation-index.ts
 */
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({
  url,
  authToken: authToken || undefined,
});

const ALTER_SQL = `
ALTER TABLE remixes ADD COLUMN selected_variation_index INTEGER NOT NULL DEFAULT 0;
`.trim();

async function main() {
  try {
    await client.execute(ALTER_SQL);
    console.log("OK: added selected_variation_index (NOT NULL DEFAULT 0)");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate column|already exists/i.test(msg)) {
      console.log("Column already exists — skipping ALTER");
    } else {
      console.error("Migration failed:", msg);
      process.exit(1);
    }
  }

  const check = await client.execute(
    "SELECT id, selected_variation_index FROM remixes LIMIT 5"
  );
  console.log("Sample rows:", JSON.stringify(check.rows, null, 2));

  const count = await client.execute("SELECT COUNT(*) AS n FROM remixes");
  console.log("Remix count:", count.rows[0]);
}

main().finally(() => client.close());
