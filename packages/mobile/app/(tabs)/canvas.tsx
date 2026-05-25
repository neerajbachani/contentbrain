import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { PlusIcon, TextTIcon, FlameIcon, LinkIcon } from "phosphor-react-native";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { getApiBase } from "../../lib/apiBase";
import { getApiAuthHeaders } from "../../lib/auth";
import { useCanvasStore, type CanvasRecord, type NodeLayout } from "../../store/canvasStore";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import {
  filterAndSortInspirations,
  collectAllTags,
  normalizeInspiration,
  isLikelyUrl,
} from "../../components/canvas/canvasUtils";
import InspirationCard, { makeCardStyles } from "../../components/canvas/InspirationCard";
import SwipeableCard from "../../components/canvas/SwipeableCard";
import CanvasToolbar from "../../components/canvas/CanvasToolbar";
import SelectionBar from "../../components/canvas/SelectionBar";
import AddContentModal from "../../components/canvas/AddContentModal";
import AnalyzingCard from "../../components/canvas/AnalyzingCard";
import ClipboardBanner from "../../components/canvas/ClipboardBanner";
import CompareSheet from "../../components/canvas/CompareSheet";
import ImageLightbox from "../../components/canvas/ImageLightbox";
import BoardView from "../../components/canvas/BoardView";
import CanvasPicker from "../../components/canvas/CanvasPicker";
import BoardNodePreview from "../../components/canvas/BoardNodePreview";
import { computeGridLayout } from "../../components/canvas/canvasLayout";
import type { InspirationItem } from "../../store/canvasStore";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBG },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: { ...typography.displayMedium, color: theme.text },
    addIconBtn: {
      backgroundColor: theme.success,
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
    emptyTitle: { ...typography.heading, color: theme.textSupporting },
    emptyText: { ...typography.caption, color: theme.placeholderText, textAlign: "center" },
    emptyActions: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 100,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyBtnText: { color: theme.text, fontSize: 13, fontWeight: "600" },
    list: { padding: 12, paddingBottom: 120 },
    undoBar: {
      position: "absolute",
      bottom: 88,
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.cardBG,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
    },
    undoText: { color: theme.text, fontSize: 13, flex: 1 },
    undoBtn: { color: theme.success, fontWeight: "700", fontSize: 13 },
    boardShell: { flex: 1 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  });
}

export default function CanvasScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cardStyles = useThemedStyles(makeCardStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const qc = useQueryClient();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialUrl, setModalInitialUrl] = useState<string | undefined>();
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [clipboardDismissed, setClipboardDismissed] = useState(false);
  const [previewItem, setPreviewItem] = useState<InspirationItem | null>(null);
  const [tidySignal, setTidySignal] = useState(0);

  const {
    selectedIds,
    filter,
    tagFilter,
    searchQuery,
    sortBy,
    viewMode,
    expandedId,
    pendingIds,
    activeCanvasId,
    compareVisible,
    showClusters,
    lastDeleted,
    setFilter,
    setTagFilter,
    setSearchQuery,
    setSortBy,
    setViewMode,
    setExpandedId,
    toggleSelect,
    clearSelection,
    setActiveCanvasId,
    setCompareVisible,
    setShowClusters,
    setLastDeleted,
  } = useCanvasStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["inspirations"],
    queryFn: async () => {
      const res = await api.inspirations.$get();
      const d = await res.json();
      const raw = "inspirations" in d ? d.inspirations : [];
      return (raw as Record<string, unknown>[]).map(normalizeInspiration);
    },
  });

  const { data: canvasesData } = useQuery({
    queryKey: ["canvases"],
    queryFn: async () => {
      const res = await api.canvases.$get();
      const d = await res.json();
      return ("canvases" in d ? d.canvases : []) as CanvasRecord[];
    },
  });

  const canvases = canvasesData ?? [];
  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) ?? canvases[0] ?? null;

  useEffect(() => {
    if (activeCanvas && !activeCanvasId) {
      setActiveCanvasId(activeCanvas.id);
    }
  }, [activeCanvas, activeCanvasId, setActiveCanvasId]);

  useEffect(() => {
    if (params.url && typeof params.url === "string") {
      setModalInitialUrl(decodeURIComponent(params.url));
      setModalVisible(true);
    }
  }, [params.url]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (clipboardDismissed) return;
        try {
          const text = await Clipboard.getStringAsync();
          if (!cancelled && isLikelyUrl(text)) {
            setClipboardUrl(text.trim());
          }
        } catch { /* ignore */ }
      })();
      return () => { cancelled = true; };
    }, [clipboardDismissed])
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.inspirations[":id"].$delete({ param: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspirations"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (item: ReturnType<typeof normalizeInspiration>) => {
      await api.inspirations.$post({
        json: {
          rawContent: item.rawContent,
          sourceUrl: item.sourceUrl,
          sourcePlatform: item.sourcePlatform,
          type: item.type,
          title: item.title,
          ogImage: item.ogImage,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspirations"] });
      setLastDeleted(null);
    },
  });

  const layoutMutation = useMutation({
    mutationFn: async ({ canvasId, layout }: { canvasId: string; layout: Record<string, NodeLayout> }) => {
      const res = await fetch(`${getApiBase()}/api/canvases/${canvasId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getApiAuthHeaders(),
        },
        body: JSON.stringify({ layoutJson: JSON.stringify(layout) }),
      });
      if (!res.ok) throw new Error("Failed to save layout");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canvases"] }),
  });

  const createCanvasMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.canvases.$post({
        json: {
          name,
          inspirationIds: (data ?? []).map((i) => i.id),
        },
      });
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["canvases"] });
      const canvas = (result as { canvas?: CanvasRecord }).canvas;
      if (canvas?.id) setActiveCanvasId(canvas.id);
    },
  });

  const refreshClusters = useCallback(async () => {
    if (!activeCanvas?.id || !showClusters) return;
    await api.canvases[":id"].clusters.$get({ param: { id: activeCanvas.id } });
    qc.invalidateQueries({ queryKey: ["canvases"] });
  }, [activeCanvas?.id, showClusters, qc]);

  useEffect(() => {
    if (showClusters && activeCanvas?.id) {
      refreshClusters();
    }
  }, [showClusters, activeCanvas?.id, refreshClusters]);

  function handleTidy() {
    if (!activeCanvas?.id) return;
    const layout = computeGridLayout(filtered);
    layoutMutation.mutate({ canvasId: activeCanvas.id, layout });
    setTidySignal((n) => n + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleBoardTap(item: InspirationItem) {
    if (selectedIds.length > 0) {
      toggleSelect(item.id);
      Haptics.selectionAsync();
      return;
    }
    setPreviewItem(item);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const inspirations = data ?? [];
  const canvasIds = activeCanvas?.inspirationIds?.length
    ? activeCanvas.inspirationIds
    : inspirations.map((i) => i.id);

  const scopedInspirations = useMemo(() => {
    const idSet = new Set(canvasIds);
    return inspirations.filter((i) => idSet.has(i.id));
  }, [inspirations, canvasIds]);

  const filtered = useMemo(
    () => filterAndSortInspirations(scopedInspirations, filter, tagFilter, searchQuery, sortBy),
    [scopedInspirations, filter, tagFilter, searchQuery, sortBy]
  );

  const availableTags = useMemo(() => collectAllTags(scopedInspirations), [scopedInspirations]);
  const selectedItems = inspirations.filter((i) => selectedIds.includes(i.id));

  function handleDelete(id: string) {
    const item = inspirations.find((i) => i.id === id);
    Alert.alert("Delete", "Remove this inspiration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (item) setLastDeleted({ id, item });
          deleteMutation.mutate(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }

  function handleSwipeDelete(id: string) {
    const item = inspirations.find((i) => i.id === id);
    if (item) setLastDeleted({ id, item });
    deleteMutation.mutate(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleMerge() {
    if (selectedIds.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/merge?ids=${selectedIds.join(",")}`);
  }

  function handleCardPress(id: string) {
    if (selectedIds.length > 0) {
      toggleSelect(id);
      Haptics.selectionAsync();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/remix/${id}`);
  }

  function handleRemix(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/remix/${id}`);
  }

  function openAddModal(url?: string) {
    setModalInitialUrl(url);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function renderCard(item: ReturnType<typeof normalizeInspiration>, compact?: boolean) {
    const isSelected = selectedIds.includes(item.id);
    const isExpanded = expandedId === item.id;
    const swipeEnabled = selectedIds.length === 0 && viewMode !== "board";

    const card = (
      <InspirationCard
        item={item}
        isSelected={isSelected}
        isExpanded={isExpanded}
        compact={compact}
        styles={cardStyles}
        onPress={() => handleCardPress(item.id)}
        onLongPress={() => {
          toggleSelect(item.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onRemix={() => handleRemix(item.id)}
        onDelete={() => handleDelete(item.id)}
        onToggleExpand={() => {
          setExpandedId(isExpanded ? null : item.id);
          Haptics.selectionAsync();
        }}
        onTagPress={(tag) => {
          setTagFilter(tag.toLowerCase());
          Haptics.selectionAsync();
        }}
        onPlatformPress={(platform) => {
          setFilter(platform.toLowerCase());
          Haptics.selectionAsync();
        }}
        onImageDoublePress={() => item.ogImage && setLightboxUri(item.ogImage)}
      />
    );

    if (swipeEnabled && !compact) {
      return (
        <SwipeableCard
          compact={compact}
          onDelete={() => handleSwipeDelete(item.id)}
          onQuickRemix={() => handleRemix(item.id)}
        >
          {card}
        </SwipeableCard>
      );
    }
    return card;
  }

  const listHeader = (
    <>
      {viewMode !== "board" && canvases.length > 0 ? (
        <CanvasPicker
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          onSelect={setActiveCanvasId}
          onCreate={(name) => createCanvasMutation.mutate(name)}
        />
      ) : null}

      {clipboardUrl && !clipboardDismissed && viewMode !== "board" ? (
        <ClipboardBanner
          url={clipboardUrl}
          onAdd={() => {
            openAddModal(clipboardUrl);
            setClipboardUrl(null);
            setClipboardDismissed(true);
          }}
          onDismiss={() => {
            setClipboardDismissed(true);
            setClipboardUrl(null);
          }}
        />
      ) : null}

      <CanvasToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        availableTags={availableTags}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        compact={viewMode === "board"}
        showClusters={showClusters}
        onToggleClusters={() => setShowClusters(!showClusters)}
        onTidy={viewMode === "board" ? handleTidy : undefined}
      />

      {pendingIds.length > 0 ? <AnalyzingCard /> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Your Canvas</Text>
          {viewMode === "board" && canvases.length > 0 ? (
            <CanvasPicker
              canvases={canvases}
              activeCanvasId={activeCanvasId}
              onSelect={setActiveCanvasId}
              onCreate={(name) => createCanvasMutation.mutate(name)}
              inline
            />
          ) : null}
        </View>
        <TouchableOpacity style={styles.addIconBtn} onPress={() => openAddModal()}>
          <PlusIcon size={22} color={theme.appBG} weight="bold" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.success} />
        </View>
      ) : viewMode === "board" ? (
        <View style={styles.boardShell}>
          {listHeader}
          <BoardView
            items={filtered}
            layoutJson={activeCanvas?.layoutJson ?? "{}"}
            clustersJson={activeCanvas?.clustersJson ?? "[]"}
            selectedIds={selectedIds}
            showClusters={showClusters}
            tidySignal={tidySignal}
            onLayoutChange={(layout) => {
              if (activeCanvas?.id) {
                layoutMutation.mutate({ canvasId: activeCanvas.id, layout });
              }
            }}
            onTap={handleBoardTap}
            onLongPress={(id) => {
              toggleSelect(id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            onRemix={handleRemix}
          />
        </View>
      ) : filtered.length === 0 && pendingIds.length === 0 ? (
        <>
          {listHeader}
          <View style={styles.centered}>
            <TextTIcon size={48} color={theme.placeholderText} />
            <Text style={styles.emptyTitle}>No inspirations yet</Text>
            <Text style={styles.emptyText}>
              Long-press to select · Swipe to remix or delete
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  if (isLikelyUrl(text)) openAddModal(text.trim());
                  else openAddModal();
                }}
              >
                <LinkIcon size={16} color={theme.text} />
                <Text style={styles.emptyBtnText}>Paste link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/(tabs)/trending")}
              >
                <FlameIcon size={16} color={theme.text} />
                <Text style={styles.emptyBtnText}>Browse Trending</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <FlatList
          data={filtered}
          key={viewMode}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          columnWrapperStyle={viewMode === "grid" ? { gap: 8, paddingHorizontal: 8 } : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.success}
            />
          }
          renderItem={({ item }) => (
            <View style={viewMode === "grid" ? { flex: 1, maxWidth: "50%", paddingHorizontal: 4 } : undefined}>
              {renderCard(item, viewMode === "grid")}
            </View>
          )}
        />
      )}

      <SelectionBar
        selectedIds={selectedIds}
        items={selectedItems}
        onCancel={clearSelection}
        onMerge={handleMerge}
        onRemix={handleRemix}
        onCompare={() => setCompareVisible(true)}
      />

      {lastDeleted ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            Deleted {lastDeleted.item.title?.slice(0, 30) ?? "item"}
          </Text>
          <TouchableOpacity
            onPress={() => restoreMutation.mutate(lastDeleted.item)}
            disabled={restoreMutation.isPending}
          >
            <Text style={styles.undoBtn}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLastDeleted(null)}>
            <Text style={[styles.undoBtn, { color: theme.placeholderText }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <CompareSheet
        visible={compareVisible}
        items={selectedItems}
        onClose={() => setCompareVisible(false)}
        onMerge={() => {
          setCompareVisible(false);
          handleMerge();
        }}
      />

      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />

      <BoardNodePreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onRemix={handleRemix}
      />

      <AddContentModal
        visible={modalVisible}
        initialUrl={modalInitialUrl}
        onClose={() => {
          setModalVisible(false);
          setModalInitialUrl(undefined);
        }}
        onAdded={() => {}}
      />
    </SafeAreaView>
  );
}
