import { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, PanResponder, Pressable,
} from "react-native";
import { SparkleIcon, DotsSixIcon } from "phosphor-react-native";
import * as Haptics from "expo-haptics";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { InspirationItem, ClusterRegion, NodeLayout } from "../../store/canvasStore";
import { getPlatformMeta } from "./canvasUtils";
import {
  computeGridLayout,
  computeCanvasSize,
  needsLayoutRepair,
  repairLayout,
  clustersFromLayout,
  NODE_W,
  NODE_H,
  CANVAS_PADDING,
} from "./canvasLayout";

const DRAG_THRESHOLD = 8;
const LONG_PRESS_MS = 450;
let hintDismissedGlobal = false;

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    canvas: { position: "relative" },
    cluster: {
      position: "absolute",
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      backgroundColor: theme.highlightBG + "44",
      padding: 8,
      zIndex: 0,
    },
    clusterLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.textSupporting,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    node: {
      position: "absolute",
      backgroundColor: theme.cardBG,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      elevation: 2,
      zIndex: 1,
    },
    nodeSelected: { borderColor: theme.success, borderWidth: 2, zIndex: 2, transform: [{ scale: 1.03 }] },
    nodeDragging: { zIndex: 3, elevation: 6 },
    nodeImage: { width: "100%", height: 56 },
    nodeBody: { padding: 8, gap: 4, flex: 1 },
    nodeTitle: { color: theme.text, fontSize: 11, fontWeight: "700", lineHeight: 14 },
    nodePlatform: { fontSize: 9, fontWeight: "600" },
    nodeFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dragHandle: { padding: 2 },
    hint: {
      position: "absolute",
      bottom: 72,
      left: 12,
      right: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.cardBG + "EE",
      borderWidth: 1,
      borderColor: theme.border,
    },
    hintText: { fontSize: 11, color: theme.placeholderText, textAlign: "center" },
    hintDismiss: { color: theme.success, fontWeight: "700", textAlign: "center", marginTop: 6, fontSize: 11 },
    minimap: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 80,
      height: 60,
      borderRadius: 8,
      backgroundColor: theme.cardBG,
      borderWidth: 1,
      borderColor: theme.border,
      opacity: 0.9,
      zIndex: 4,
    },
    minimapDot: {
      position: "absolute",
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.success,
    },
  });
}

function parseLayout(raw: string): Record<string, NodeLayout> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function parseClusters(raw: string): ClusterRegion[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type BoardNodeProps = {
  item: InspirationItem;
  layout: NodeLayout;
  isSelected: boolean;
  isDragging: boolean;
  styles: ReturnType<typeof makeStyles>;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTap: () => void;
  onLongPress: () => void;
  onRemix: () => void;
  onDragStart: () => void;
  onDragEndVisual: () => void;
};

function BoardNode({
  item, layout, isSelected, isDragging, styles, onDragEnd, onTap, onLongPress, onRemix,
  onDragStart, onDragEndVisual,
}: BoardNodeProps) {
  const theme = useTheme();
  const meta = getPlatformMeta(item.sourcePlatform, theme.placeholderText);
  const [pos, setPos] = useState({ x: layout.x, y: layout.y });
  const dragOrigin = useRef({ x: layout.x, y: layout.y });
  const dragEnabled = useRef(false);
  const didLongPress = useRef(false);

  useEffect(() => {
    setPos({ x: layout.x, y: layout.y });
    dragOrigin.current = { x: layout.x, y: layout.y };
  }, [layout.x, layout.y]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => dragEnabled.current,
      onPanResponderGrant: () => {
        dragOrigin.current = { ...pos };
        onDragStart();
      },
      onPanResponderMove: (_, gesture) => {
        if (!dragEnabled.current) return;
        setPos({
          x: dragOrigin.current.x + gesture.dx,
          y: dragOrigin.current.y + gesture.dy,
        });
      },
      onPanResponderRelease: (_, gesture) => {
        dragEnabled.current = false;
        onDragEndVisual();
        onDragEnd(
          item.id,
          dragOrigin.current.x + gesture.dx,
          dragOrigin.current.y + gesture.dy
        );
      },
      onPanResponderTerminate: () => {
        dragEnabled.current = false;
        onDragEndVisual();
        setPos(dragOrigin.current);
      },
    })
  ).current;

  const startDragMode = () => {
    dragEnabled.current = true;
    onDragStart();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const title = item.title || item.rawContent;
  const displayTitle = title.length > 60 ? `${title.slice(0, 57)}…` : title;

  return (
    <Pressable
      {...panResponder.panHandlers}
      onLongPress={() => {
        didLongPress.current = true;
        onLongPress();
        startDragMode();
      }}
      delayLongPress={LONG_PRESS_MS}
      onPress={() => {
        if (!dragEnabled.current && !didLongPress.current) onTap();
        didLongPress.current = false;
      }}
      style={[
        styles.node,
        {
          left: pos.x,
          top: pos.y,
          width: NODE_W,
          height: NODE_H,
        },
        isSelected && styles.nodeSelected,
        isDragging && styles.nodeDragging,
      ]}
    >
      {item.ogImage ? (
        <Image source={{ uri: item.ogImage }} style={styles.nodeImage} resizeMode="cover" />
      ) : null}
      <View style={styles.nodeBody}>
        <Text style={[styles.nodePlatform, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.nodeTitle} numberOfLines={2}>{displayTitle}</Text>
        <View style={styles.nodeFooter}>
          <TouchableOpacity onPress={onRemix} hitSlop={8}>
            <SparkleIcon size={14} color={theme.success} weight="fill" />
          </TouchableOpacity>
          <TouchableOpacity onPressIn={startDragMode} style={styles.dragHandle} hitSlop={10}>
            <DotsSixIcon size={14} color={theme.placeholderText} />
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

type Props = {
  items: InspirationItem[];
  layoutJson: string;
  clustersJson: string;
  selectedIds: string[];
  showClusters: boolean;
  onLayoutChange: (layout: Record<string, NodeLayout>) => void;
  onTap: (item: InspirationItem) => void;
  onLongPress: (id: string) => void;
  onRemix: (id: string) => void;
  tidySignal?: number;
};

export default function BoardView({
  items,
  layoutJson,
  clustersJson,
  selectedIds,
  showClusters,
  onLayoutChange,
  onTap,
  onLongPress,
  onRemix,
  tidySignal = 0,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const layoutRef = useRef(parseLayout(layoutJson));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repairedRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const rawClusters = parseClusters(clustersJson);

  useEffect(() => {
    layoutRef.current = parseLayout(layoutJson);
  }, [layoutJson]);

  useEffect(() => {
    if (!hintDismissedGlobal) setShowHint(true);
  }, []);

  const applyLayout = useCallback(
    (layout: Record<string, NodeLayout>, persist = true) => {
      layoutRef.current = layout;
      setLayoutVersion((v) => v + 1);
      if (persist) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onLayoutChange(layout), 600);
      }
    },
    [onLayoutChange]
  );

  useEffect(() => {
    if (items.length === 0 || repairedRef.current) return;
    const current = parseLayout(layoutJson);
    if (needsLayoutRepair(current, items)) {
      const fixed = repairLayout(current, items);
      applyLayout(fixed);
      repairedRef.current = true;
    }
  }, [items, layoutJson, applyLayout]);

  useEffect(() => {
    if (tidySignal === 0) return;
    applyLayout(computeGridLayout(items));
  }, [tidySignal, items, applyLayout]);

  const canvasSize = computeCanvasSize(layoutRef.current);
  const visibleClusters = showClusters
    ? clustersFromLayout(rawClusters, layoutRef.current)
    : [];

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [items.length, layoutVersion]);

  const getLayout = useCallback(
    (id: string, index: number) => {
      const existing = layoutRef.current[id];
      if (existing) return { ...existing, w: NODE_W, h: NODE_H };
      return computeGridLayout(items)[id] ?? {
        x: CANVAS_PADDING,
        y: CANVAS_PADDING + index * (NODE_H + 16),
        w: NODE_W,
        h: NODE_H,
      };
    },
    [items]
  );

  const handleDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const clampedX = Math.max(12, Math.min(canvasSize.width - NODE_W - 12, x));
      const clampedY = Math.max(12, Math.min(canvasSize.height - NODE_H - 12, y));
      const current = { ...layoutRef.current };
      const node = current[id] ?? getLayout(id, 0);
      current[id] = { ...node, x: clampedX, y: clampedY, w: NODE_W, h: NODE_H };
      applyLayout(current);
    },
    [canvasSize.width, canvasSize.height, getLayout, applyLayout]
  );

  function dismissHint() {
    hintDismissedGlobal = true;
    setShowHint(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ width: canvasSize.width, height: canvasSize.height }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
      >
        <View style={[styles.canvas, { width: canvasSize.width, height: canvasSize.height }]}>
          {visibleClusters.map((cluster) => (
            <View
              key={cluster.id}
              style={[
                styles.cluster,
                { left: cluster.x, top: cluster.y, width: cluster.w, height: cluster.h },
              ]}
            >
              <Text style={styles.clusterLabel}>{cluster.label}</Text>
            </View>
          ))}

          {items.map((item, index) => (
            <BoardNode
              key={item.id}
              item={item}
              layout={getLayout(item.id, index)}
              isSelected={selectedIds.includes(item.id)}
              isDragging={draggingId === item.id}
              styles={styles}
              onDragEnd={handleDragEnd}
              onTap={() => onTap(item)}
              onLongPress={() => onLongPress(item.id)}
              onRemix={() => onRemix(item.id)}
              onDragStart={() => setDraggingId(item.id)}
              onDragEndVisual={() => setDraggingId(null)}
            />
          ))}
        </View>
      </ScrollView>

      {items.length >= 10 ? (
        <View style={styles.minimap} pointerEvents="none">
          {items.slice(0, 40).map((item, index) => {
            const l = getLayout(item.id, index);
            return (
              <View
                key={item.id}
                style={[
                  styles.minimapDot,
                  {
                    left: (l.x / canvasSize.width) * 72,
                    top: (l.y / canvasSize.height) * 52,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}

      {showHint ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Scroll to pan · Long-press or drag handle to move · Tap for preview
          </Text>
          <TouchableOpacity onPress={dismissHint}>
            <Text style={styles.hintDismiss}>Got it</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
