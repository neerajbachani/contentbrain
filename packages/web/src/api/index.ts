import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { authMiddleware } from "./middleware/auth";
import { inspirationsRoute } from "./routes/inspirations";
import { remixesRoute } from "./routes/remixes";
import { mergeRoute } from "./routes/merge";
import { trendsRoute } from "./routes/trends";
import { scrapeRoute } from "./routes/scrape";
import { usersRoute } from "./routes/users";
import { startScheduler } from "./jobs/scheduler";

// Start background scheduler (safe to call multiple times — idempotent)
startScheduler();

const app = new Hono()
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
  .route("/users", usersRoute);

export type AppType = typeof app;
export default app;
