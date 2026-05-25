import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { randomUUID } from "crypto";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { inspirationsRoute } from "./routes/inspirations";
import { remixesRoute } from "./routes/remixes";
import { mergeRoute } from "./routes/merge";
import { trendsRoute } from "./routes/trends";
import { scrapeRoute } from "./routes/scrape";
import { usersRoute } from "./routes/users";
import { integrationsRoute } from "./routes/integrations";
import { canvasesRoute } from "./routes/canvases";
import { xRoute } from "./routes/x";
import { startScheduler } from "./jobs/scheduler";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

// Start background scheduler after a short delay so the server binds first
setTimeout(() => startScheduler(), 5000);

const app = new Hono()
  .use("*", async (c, next) => {
    const startedAt = Date.now();
    const requestId = c.req.header("x-request-id")?.trim() || randomUUID();
    c.set("requestId", requestId);

    try {
      await next();
    } finally {
      c.header("x-request-id", requestId);
      const user = c.get("user");
      const payload = {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - startedAt,
        userId: user?.id ?? null,
      };
      console.info(`[api] ${payload.method} ${payload.path}`, payload);
    }
  })
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true, exposeHeaders: ["set-auth-token"] }))
  .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
  .basePath("api")
  .use("*", authMiddleware)
  .get("/health", (c) => c.json({ status: "ok" }, 200))
  .route("/inspirations", inspirationsRoute)
  .route("/remixes", remixesRoute)
  .route("/merge", mergeRoute)
  .route("/trends", trendsRoute)
  .route("/scrape", scrapeRoute)
  .route("/users", usersRoute)
  .route("/integrations", integrationsRoute)
  .route("/canvases", canvasesRoute)
  .route("/x", xRoute)
  .onError((err, c) => {
    const requestId = c.get("requestId");
    const status = err instanceof HTTPException ? err.status : 500;
    const message = err instanceof HTTPException ? err.message : "Internal Server Error";

    console.error("[api:error]", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    c.header("x-request-id", requestId);
    return c.json(
      {
        error: message,
        code: status,
        requestId,
        path: c.req.path,
        method: c.req.method,
      },
      status
    );
  })
  .notFound((c) => {
    const requestId = c.get("requestId");
    c.header("x-request-id", requestId);
    return c.json(
      {
        error: "Not Found",
        code: 404,
        requestId,
        path: c.req.path,
        method: c.req.method,
      },
      404
    );
  });

export type AppType = typeof app;
export default app;
