import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import { resolve, extname } from "path";

const port = 8080;
const distDir = resolve(import.meta.dir, "dist");

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

// Lazy-loaded API — only imported on first request so server binds instantly
let apiApp: Hono | null = null;
async function getApi(): Promise<Hono> {
  if (!apiApp) {
    const mod = await import("./src/api/index");
    apiApp = mod.default as Hono;
  }
  return apiApp;
}

const server = new Hono();

// Health check — responds immediately, no DB needed
server.get("/api/health", (c) => c.json({ status: "ok" }));

// All other API routes — lazy load the full app
server.all("/api/*", async (c) => {
  const api = await getApi();
  return api.fetch(c.req.raw);
});

// Static files from dist/
server.get("*", async (c) => {
  const url = new URL(c.req.url);
  let filePath = resolve(distDir, url.pathname.replace(/^\//, ""));

  if (!existsSync(filePath) || !filePath.startsWith(distDir)) {
    filePath = resolve(distDir, "index.html");
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] ?? "application/octet-stream";
    return new Response(content, {
      headers: { "content-type": contentType },
    });
  } catch {
    return c.notFound();
  }
});

Bun.serve({
  fetch: server.fetch,
  port,
  hostname: "0.0.0.0",
});

console.log(`[server] listening on http://0.0.0.0:${port}`);
