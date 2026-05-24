import { create } from "zustand";

export type ContentType = "tweet" | "reel" | "reddit" | "blog" | "url" | "text" | "other" | "thread" | "meme" | "all";
export type ViewMode = "feed" | "grid" | "board";
export type SortBy = "newest" | "oldest" | "most_ideas";

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

export interface CanvasRecord {
  id: string;
  name: string;
  inspirationIds: string[];
  remixIds: string[];
  layoutJson: string;
  viewState: string;
  clustersJson: string;
  updatedAt: string;
}

export interface NodeLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  pinned?: boolean;
}

export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ClusterRegion {
  id: string;
  label: string;
  inspirationIds: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasStore {
  inspirations: InspirationItem[];
  selectedIds: string[];
  filter: string;
  tagFilter: string | null;
  searchQuery: string;
  sortBy: SortBy;
  viewMode: ViewMode;
  expandedId: string | null;
  pendingIds: string[];
  activeCanvasId: string | null;
  compareVisible: boolean;
  showClusters: boolean;
  lastDeleted: { id: string; item: InspirationItem } | null;
  setInspirations: (items: InspirationItem[]) => void;
  addInspiration: (item: InspirationItem) => void;
  removeInspiration: (id: string) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setFilter: (f: string) => void;
  setTagFilter: (tag: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSortBy: (s: SortBy) => void;
  setViewMode: (m: ViewMode) => void;
  setExpandedId: (id: string | null) => void;
  addPendingId: (id: string) => void;
  removePendingId: (id: string) => void;
  setActiveCanvasId: (id: string | null) => void;
  setCompareVisible: (v: boolean) => void;
  setShowClusters: (v: boolean) => void;
  setLastDeleted: (v: { id: string; item: InspirationItem } | null) => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  inspirations: [],
  selectedIds: [],
  filter: "all",
  tagFilter: null,
  searchQuery: "",
  sortBy: "newest",
  viewMode: "feed",
  expandedId: null,
  pendingIds: [],
  activeCanvasId: null,
  compareVisible: false,
  showClusters: false,
  lastDeleted: null,
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
  clearSelection: () => set({ selectedIds: [], compareVisible: false }),
  setFilter: (filter) => set({ filter }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setViewMode: (viewMode) => set({ viewMode }),
  setExpandedId: (expandedId) => set({ expandedId }),
  addPendingId: (id) => set((s) => ({ pendingIds: [...s.pendingIds, id] })),
  removePendingId: (id) => set((s) => ({ pendingIds: s.pendingIds.filter((pid) => pid !== id) })),
  setActiveCanvasId: (activeCanvasId) => set({ activeCanvasId }),
  setCompareVisible: (compareVisible) => set({ compareVisible }),
  setShowClusters: (showClusters) => set({ showClusters }),
  setLastDeleted: (lastDeleted) => set({ lastDeleted }),
}));
