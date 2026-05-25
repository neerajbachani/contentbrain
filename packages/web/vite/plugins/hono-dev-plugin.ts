import type { Plugin, ViteDevServer, PreviewServer } from "vite";

export default function honoDevPlugin(): Plugin {
  return {
    name: "hono-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        await handleRequest(req, res, next, (path) => server.ssrLoadModule(path));
      });
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        await handleRequest(req, res, next, async (path) => {
          // In preview mode, import the compiled API directly
          return import(/* @vite-ignore */ path);
        });
      });
    },
  };
}

async function handleRequest(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
  next: () => void,
  loader: (path: string) => Promise<any>
) {
  try {
    const request = toWebRequest(req);
    const mod = await loader("/src/api/index.ts");
    const app = mod.default;
    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error("[hono-dev]", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}

function toWebRequest(req: import("http").IncomingMessage): Request {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error duplex needed for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}
