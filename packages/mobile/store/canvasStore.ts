import { create } from "zustand";

export type ContentType = "tweet" | "reel" | "reddit" | "blog" | "url" | "text" | "other" | "thread" | "meme" | "all";

export interface InspirationItem {
  id: string;
  type: string;
  sourcePlatform: string;
  sourceUrl?: string | null;
  rawContent: string;
  ogImage?: string | null;
  title?: string | null;
  tags: string[];
  summary?: string | null;
  writingStyle?: string | null;
  keyIdeas: string[];
  hook?: string | null;
  createdAt: Date | string;
  userId: string;
}

interface CanvasStore {
  inspirations: InspirationItem[];
  selectedIds: string[];
  filter: string;
  setInspirations: (items: InspirationItem[]) => void;
  addInspiration: (item: InspirationItem) => void;
  removeInspiration: (id: string) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setFilter: (f: string) => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  inspirations: [],
  selectedIds: [],
  filter: "all",
  setInspirations: (inspirations) => set({ inspirations }),
  addInspiration: (item) => set((s) => ({ inspirations: [item, ...s.inspirations] })),
  removeInspiration: (id) =>
    set((s) => ({
      inspirations: s.inspirations.filter((i) => i.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    })),
  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((sid) => sid !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),
  setFilter: (filter) => set({ filter }),
}));
