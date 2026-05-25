import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import { resolve, extname } from "path";
import app from "./src/api/index";

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

const server = new Hono();

// API routes
server.route("/", app);

// Static file serving + SPA fallback
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
