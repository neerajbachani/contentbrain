import type { InspirationItem, NodeLayout, ClusterRegion } from "../../store/canvasStore";

export const NODE_W = 168;
export const NODE_H = 140;
export const GRID_GAP = 16;
export const CANVAS_PADDING = 48;
export const MIN_CANVAS_SIZE = 800;
export const GRID_COLS = 3;

export function computeGridLayout(
  items: InspirationItem[],
  startX = CANVAS_PADDING,
  startY = CANVAS_PADDING
): Record<string, NodeLayout> {
  const layout: Record<string, NodeLayout> = {};
  items.forEach((item, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    layout[item.id] = {
      x: startX + col * (NODE_W + GRID_GAP),
      y: startY + row * (NODE_H + GRID_GAP),
      w: NODE_W,
      h: NODE_H,
    };
  });
  return layout;
}

function rectsOverlap(a: NodeLayout, b: NodeLayout): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export function detectOverlaps(layout: Record<string, NodeLayout>): boolean {
  const entries = Object.entries(layout);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (rectsOverlap(entries[i][1], entries[j][1])) return true;
    }
  }
  return false;
}

export function hasStackedCoords(layout: Record<string, NodeLayout>, items: InspirationItem[]): boolean {
  if (items.length < 2) return false;
  const coords = items.map((item) => {
    const node = layout[item.id];
    return node ? `${Math.round(node.x / 20)}:${Math.round(node.y / 20)}` : null;
  }).filter(Boolean);
  const unique = new Set(coords);
  return unique.size / items.length < 0.7;
}

export function repairLayout(
  layout: Record<string, NodeLayout>,
  items: InspirationItem[]
): Record<string, NodeLayout> {
  if (items.length === 0) return {};
  const fresh = computeGridLayout(items);
  const result: Record<string, NodeLayout> = { ...fresh };

  for (const item of items) {
    const existing = layout[item.id];
    if (!existing) continue;
    const candidate = { ...existing, w: NODE_W, h: NODE_H };
    const overlaps = Object.entries(result).some(
      ([id, node]) => id !== item.id && rectsOverlap(candidate, node)
    );
    if (!overlaps) {
      result[item.id] = candidate;
    }
  }

  return result;
}

export function needsLayoutRepair(
  layout: Record<string, NodeLayout>,
  items: InspirationItem[]
): boolean {
  if (items.length === 0) return false;
  const missing = items.some((item) => !layout[item.id]);
  if (missing || Object.keys(layout).length === 0) return true;
  if (detectOverlaps(layout)) return true;
  return hasStackedCoords(layout, items);
}

export function computeCanvasSize(layout: Record<string, NodeLayout>): { width: number; height: number } {
  let maxX = MIN_CANVAS_SIZE;
  let maxY = MIN_CANVAS_SIZE;
  for (const node of Object.values(layout)) {
    maxX = Math.max(maxX, node.x + node.w + CANVAS_PADDING);
    maxY = Math.max(maxY, node.y + node.h + CANVAS_PADDING);
  }
  return { width: maxX, height: maxY };
}

export function computeClusterBounds(
  cluster: ClusterRegion,
  layout: Record<string, NodeLayout>
): ClusterRegion | null {
  const nodes = cluster.inspirationIds
    .map((id) => layout[id])
    .filter(Boolean) as NodeLayout[];
  if (nodes.length < 2) return null;

  const minX = Math.min(...nodes.map((n) => n.x)) - 12;
  const minY = Math.min(...nodes.map((n) => n.y)) - 28;
  const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + 12;
  const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + 12;

  return {
    ...cluster,
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  } as ClusterRegion & { w: number; h: number };
}

export function clustersFromLayout(
  clusters: ClusterRegion[],
  layout: Record<string, NodeLayout>
): ClusterRegion[] {
  return clusters
    .map((c) => computeClusterBounds(c, layout))
    .filter(Boolean) as ClusterRegion[];
}
