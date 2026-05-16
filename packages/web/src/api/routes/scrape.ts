import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getLinkPreview } from "../services/linkPreview/ogScraper";

export const scrapeRoute = new Hono()
  // POST /scrape — scrape a URL for OG metadata (with DB + memory caching)
  .post("/", requireAuth, async (c) => {
    const { url } = await c.req.json();
    if (!url || typeof url !== "string") {
      return c.json({ message: "url required" }, 400);
    }

    try {
      const preview = await getLinkPreview(url);
      return c.json(preview, 200);
    } catch {
      return c.json(
        { url, title: null, description: null, imageUrl: null, siteName: null },
        200
      );
    }
  });
