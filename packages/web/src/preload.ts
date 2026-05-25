// Runs before all module imports via bun --preload
// Uses sync readFileSync so env vars are set before any module executes
import { existsSync, readFileSync } from "fs";
import path from "path";

// import.meta.dir = packages/web/src — so ../../../ = repo root
const envPath = path.resolve(import.meta.dir, "../../../.env");

if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Don't override vars already injected by platform
    if (key && !process.env[key]) process.env[key] = val;
  }
}
