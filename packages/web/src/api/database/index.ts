import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { existsSync, readFileSync } from "fs";
import path from "path";
import * as schema from "./schema";

// Load .env if DATABASE_URL not already set (Runable publish may not inject env vars before module load)
if (!process.env.DATABASE_URL) {
  // Try multiple possible .env locations
  const candidates = [
    path.resolve(import.meta.dir, "../../../../.env"),   // from src/api/database/ -> repo root
    path.resolve(import.meta.dir, "../../../../../.env"), // extra level just in case
    path.resolve(process.cwd(), ".env"),                  // from CWD
    path.resolve(process.cwd(), "../../.env"),            // from packages/web -> repo root
  ];
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const text = readFileSync(envPath, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key === "PORT") continue;
        if (key && !process.env[key]) process.env[key] = val;
      }
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required but not set");
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
