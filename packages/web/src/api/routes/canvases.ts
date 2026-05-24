import { Hono } from "hono";
import { db } from "../database";
import * as schema from "../database/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { randomUUID } from "crypto";

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function serializeCanvas(row: typeof schema.canvases.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    inspirationIds: parseJsonArray(row.inspirationIds),
    remixIds: parseJsonArray(row.remixIds),
    layoutJson: row.layoutJson ?? "{}",
    viewState: row.viewState ?? "{}",
    clustersJson: row.clustersJson ?? "[]",
    updatedAt: row.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function computeTagClusters(
  inspirationIds: string[],
  inspirations: (typeof schema.inspirations.$inferSelect)[]
) {
  const byId = new Map(inspirations.map((i) => [i.id, i]));
  const tagToIds = new Map<string, string[]>();

  for (const id of inspirationIds) {
    const item = byId.get(id);
    if (!item) continue;
    let tags: string[] = [];
    try {
      tags = JSON.parse(item.tags || "[]");
    } catch {
      tags = [];
    }
    for (const tag of tags) {
      const key = String(tag).toLowerCase();
      if (!key) continue;
      const list = tagToIds.get(key) ?? [];
      list.push(id);
      tagToIds.set(key, list);
    }
  }

  const clusters = [...tagToIds.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([tag, ids], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        id: `cluster-${tag}`,
        label: tag,
        inspirationIds: [...new Set(ids)],
        x: 40 + col * 320,
        y: 40 + row * 280,
        w: 280,
        h: 220,
      };
    });

  return clusters;
}

async function ensureDefaultCanvas(userId: string) {
  const existing = await db
    .select()
    .from(schema.canvases)
    .where(eq(schema.canvases.userId, userId))
    .orderBy(schema.canvases.updatedAt);

  if (existing.length > 0) {
    return existing.map(serializeCanvas);
  }

  const inspirations = await db
    .select({ id: schema.inspirations.id })
    .from(schema.inspirations)
    .where(eq(schema.inspirations.userId, userId))
    .orderBy(schema.inspirations.createdAt);

  const id = randomUUID();
  const inspirationIds = inspirations.map((i) => i.id).reverse();
  const layout: Record<string, { x: number; y: number; w: number; h: number }> = {};
  inspirationIds.forEach((inspId, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    layout[inspId] = { x: 48 + col * 184, y: 48 + row * 156, w: 168, h: 140 };
  });

  const clusters = computeTagClusters(
    inspirationIds,
    await db
      .select()
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, userId))
  );

  const now = new Date();
  await db.insert(schema.canvases).values({
    id,
    userId,
    name: "Main Canvas",
    inspirationIds: JSON.stringify(inspirationIds),
    remixIds: "[]",
    layoutJson: JSON.stringify(layout),
    viewState: JSON.stringify({ scale: 1, offsetX: 0, offsetY: 0 }),
    clustersJson: JSON.stringify(clusters),
    updatedAt: now,
  });

  const row = await db
    .select()
    .from(schema.canvases)
    .where(eq(schema.canvases.id, id))
    .get();

  return row ? [serializeCanvas(row)] : [];
}

export const canvasesRoute = new Hono()
  .get("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    let canvases = await ensureDefaultCanvas(user.id);

    const allInspirations = await db
      .select({ id: schema.inspirations.id })
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, user.id))
      .orderBy(schema.inspirations.createdAt);

    const allIds = allInspirations.map((i) => i.id).reverse();
    const main = canvases.find((cv) => cv.name === "Main Canvas") ?? canvases[0];

    if (main) {
      const currentIds = new Set(main.inspirationIds);
      const missing = allIds.filter((id) => !currentIds.has(id));
      if (missing.length > 0) {
        const mergedIds = [...new Set([...missing, ...main.inspirationIds])];
        await db
          .update(schema.canvases)
          .set({
            inspirationIds: JSON.stringify(mergedIds),
            updatedAt: new Date(),
          })
          .where(eq(schema.canvases.id, main.id));

        canvases = await db
          .select()
          .from(schema.canvases)
          .where(eq(schema.canvases.userId, user.id))
          .orderBy(schema.canvases.updatedAt)
          .then((rows) => rows.map(serializeCanvas));
      }
    }

    return c.json({ canvases }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Canvas";
    const inspirationIds = Array.isArray(body.inspirationIds) ? body.inspirationIds.map(String) : [];

    const id = randomUUID();
    const now = new Date();
    await db.insert(schema.canvases).values({
      id,
      userId: user.id,
      name,
      inspirationIds: JSON.stringify(inspirationIds),
      remixIds: "[]",
      layoutJson: "{}",
      viewState: JSON.stringify({ scale: 1, offsetX: 0, offsetY: 0 }),
      clustersJson: "[]",
      updatedAt: now,
    });

    const row = await db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.id, id))
      .get();

    return c.json({ canvas: row ? serializeCanvas(row) : null }, 201);
  })
  .get("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const row = await db
      .select()
      .from(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)))
      .get();

    if (!row) return c.json({ message: "Canvas not found" }, 404);
    return c.json({ canvas: serializeCanvas(row) }, 200);
  })
  .patch("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)))
      .get();

    if (!existing) return c.json({ message: "Canvas not found" }, 404);

    const updates: Partial<typeof schema.canvases.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (Array.isArray(body.inspirationIds)) {
      updates.inspirationIds = JSON.stringify(body.inspirationIds.map(String));
    }
    if (body.layoutJson !== undefined) {
      updates.layoutJson =
        typeof body.layoutJson === "string" ? body.layoutJson : JSON.stringify(body.layoutJson);
    }
    if (body.viewState !== undefined) {
      updates.viewState =
        typeof body.viewState === "string" ? body.viewState : JSON.stringify(body.viewState);
    }
    if (body.clustersJson !== undefined) {
      updates.clustersJson =
        typeof body.clustersJson === "string" ? body.clustersJson : JSON.stringify(body.clustersJson);
    }

    await db.update(schema.canvases).set(updates).where(eq(schema.canvases.id, id));

    const row = await db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.id, id))
      .get();

    return c.json({ canvas: row ? serializeCanvas(row) : null }, 200);
  })
  .patch("/:id/layout", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)))
      .get();

    if (!existing) return c.json({ message: "Canvas not found" }, 404);

    const currentLayout = parseJsonObject(existing.layoutJson);
    const patch =
      typeof body.layout === "object" && body.layout !== null ? body.layout : parseJsonObject(String(body.layoutJson ?? "{}"));

    const merged = { ...currentLayout, ...patch };
    const viewState =
      body.viewState !== undefined
        ? typeof body.viewState === "string"
          ? body.viewState
          : JSON.stringify(body.viewState)
        : existing.viewState;

    await db
      .update(schema.canvases)
      .set({
        layoutJson: JSON.stringify(merged),
        viewState,
        updatedAt: new Date(),
      })
      .where(eq(schema.canvases.id, id));

    const row = await db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.id, id))
      .get();

    return c.json({ canvas: row ? serializeCanvas(row) : null }, 200);
  })
  .get("/:id/clusters", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();

    const canvas = await db
      .select()
      .from(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)))
      .get();

    if (!canvas) return c.json({ message: "Canvas not found" }, 404);

    const inspirationIds = parseJsonArray(canvas.inspirationIds);
    const inspirations = await db
      .select()
      .from(schema.inspirations)
      .where(eq(schema.inspirations.userId, user.id));

    const clusters = computeTagClusters(inspirationIds, inspirations);

    await db
      .update(schema.canvases)
      .set({
        clustersJson: JSON.stringify(clusters),
        updatedAt: new Date(),
      })
      .where(eq(schema.canvases.id, id));

    return c.json({ clusters }, 200);
  })
  .post("/:id/auto-layout", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();

    const canvas = await db
      .select()
      .from(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)))
      .get();

    if (!canvas) return c.json({ message: "Canvas not found" }, 404);

    const inspirationIds = parseJsonArray(canvas.inspirationIds);
    const layout: Record<string, { x: number; y: number; w: number; h: number }> = {};
    inspirationIds.forEach((inspId, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      layout[inspId] = { x: 48 + col * 184, y: 48 + row * 156, w: 168, h: 140 };
    });

    await db
      .update(schema.canvases)
      .set({
        layoutJson: JSON.stringify(layout),
        updatedAt: new Date(),
      })
      .where(eq(schema.canvases.id, id));

    const row = await db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.id, id))
      .get();

    return c.json({ canvas: row ? serializeCanvas(row) : null }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();

    const all = await db
      .select()
      .from(schema.canvases)
      .where(eq(schema.canvases.userId, user.id));

    if (all.length <= 1) {
      return c.json({ message: "Cannot delete the last canvas" }, 400);
    }

    await db
      .delete(schema.canvases)
      .where(and(eq(schema.canvases.id, id), eq(schema.canvases.userId, user.id)));

    return c.json({ ok: true }, 200);
  });
