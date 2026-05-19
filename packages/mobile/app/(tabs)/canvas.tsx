import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator,
  ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { useCanvasStore } from "../../store/canvasStore";
import * as Haptics from "expo-haptics";
import {
  PlusIcon, TwitterLogoIcon, RedditLogoIcon, InstagramLogoIcon,
  GlobeIcon, TextTIcon, TrashIcon, ArrowsOutIcon, SparkleIcon,
  XIcon, CheckCircleIcon, YoutubeLogo,
} from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";

// Platform-specific colors are brand constants — they do NOT change with theme
const PLATFORM_COLORS = {
  twitter:   "#1D9BF0",
  reddit:    "#FF4500",
  instagram: "#E1306C",
  youtube:   "#FF0000",
  news:      "#6366F1",
} as const;

const FILTERS = ["all", "tweet", "reel", "reddit", "blog", "text", "url"] as const;

const PLATFORMS = [
  { label: "Twitter/X", value: "twitter" },
  { label: "Instagram", value: "instagram" },
  { label: "Reddit", value: "reddit" },
  { label: "YouTube", value: "youtube" },
  { label: "Blog", value: "blog" },
  { label: "Custom", value: "custom" },
];

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBG },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { ...typography.displayMedium, color: theme.text },
    addIconBtn: { backgroundColor: theme.success, width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    filtersScroll: { flexGrow: 0 },
    filtersContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBG },
    filterChipActive: { backgroundColor: theme.success, borderColor: theme.success },
    filterChipText: { color: theme.textSupporting, fontSize: 13, fontWeight: "500" },
    filterChipTextActive: { color: theme.appBG, fontWeight: "700" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyTitle: { ...typography.heading, color: theme.textSupporting },
    emptyText: { ...typography.caption, color: theme.placeholderText, textAlign: "center" },

    // List
    list: { padding: 12, gap: 12, paddingBottom: 100 },

    // Card base
    card: {
      backgroundColor: theme.cardBG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    cardNoImage: {
      padding: 14,
      gap: 10,
    },

    // Image card
    imageContainer: {
      width: "100%",
      height: 200,
      position: "relative",
    },
    cardImage: {
      width: "100%",
      height: "100%",
      backgroundColor: theme.highlightBG,
    },
    platformBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
      borderWidth: 1,
      backgroundColor: theme.appBG + "CC",
    },
    platformBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    deleteOverlay: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: theme.appBG + "CC",
      alignItems: "center",
      justifyContent: "center",
    },
    selectedOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.success + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: {
      padding: 14,
      gap: 8,
    },

    // No-image card header
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    platformRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    platformLabel: { fontSize: 12, fontWeight: "600" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },

    // Shared content
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    cardTitle: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
    cardSummary: { color: theme.textSupporting, fontSize: 13, lineHeight: 18 },

    // Tags
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { backgroundColor: theme.highlightBG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
    tagText: { color: theme.placeholderText, fontSize: 11 },

    // Type badge
    typeBadge: { backgroundColor: theme.highlightBG, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
    typeBadgeText: { color: theme.placeholderText, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

    // Actions
    cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 2 },
    remixBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.success, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
    remixBtnFull: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.success, paddingVertical: 10, borderRadius: 100, marginTop: 2 },
    remixBtnText: { color: theme.appBG, fontSize: 13, fontWeight: "700" },

    // Multi-select bar
    selectBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: theme.highlightBG, borderTopWidth: 1, borderTopColor: theme.border, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    selectBarText: { color: theme.success, fontWeight: "700", fontSize: 15 },
    selectBarActions: { flexDirection: "row", gap: 10, alignItems: "center" },
    cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
    cancelBtnText: { color: theme.textSupporting, fontSize: 14 },
    mergeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.success, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
    mergeBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 14 },

    // Modal
    modalRoot: { flex: 1, backgroundColor: theme.cardBG },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
    modalTitle: { ...typography.heading, color: theme.text },
    modalBody: { padding: 20, gap: 16 },
    modeToggle: { flexDirection: "row", backgroundColor: theme.highlightBG, borderRadius: 10, padding: 4, gap: 4 },
    modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    modeBtnActive: { backgroundColor: theme.success },
    modeBtnText: { color: theme.textSupporting, fontSize: 14, fontWeight: "500" },
    modeBtnTextActive: { color: theme.appBG, fontWeight: "700" },
    error: { color: theme.danger, fontSize: 13, backgroundColor: "#EF444420", padding: 10, borderRadius: 8 },
    input: { backgroundColor: theme.highlightBG, color: theme.text, padding: 14, borderRadius: 12, fontSize: 15 },
    textArea: { height: 120 },
    label: { color: theme.textSupporting, fontSize: 13, fontWeight: "500" },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBG },
    chipSelected: { backgroundColor: theme.success, borderColor: theme.success },
    chipText: { color: theme.textSupporting, fontSize: 13 },
    chipTextSelected: { color: theme.appBG, fontWeight: "700" },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.success, padding: 16, borderRadius: 100, marginTop: 8 },
    addBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 16 },
  });
}

function getPlatformMeta(platform: string, placeholderColor: string) {
  const p = platform?.toLowerCase();
  const color = (PLATFORM_COLORS as Record<string, string>)[p] ?? placeholderColor;
  const labelMap: Record<string, string> = {
    twitter: "Twitter/X", x: "Twitter/X", reddit: "Reddit",
    instagram: "Instagram", youtube: "YouTube", news: "News", blog: "News",
  };
  return { label: labelMap[p] ?? (platform ?? "Custom"), color };
}

function detectPlatformFromUrl(value: string): string | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("twitter.com") || normalized.includes("x.com")) return "twitter";
  if (normalized.includes("reddit.com")) return "reddit";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "youtube";
  if (normalized.includes("instagram.com")) return "instagram";
  return null;
}

function PlatformIcon({ platform, size = 14, color }: { platform: string; size?: number; color?: string }) {
  const theme = useTheme();
  const meta = getPlatformMeta(platform, theme.placeholderText);
  const c = color ?? meta.color;
  const p = platform?.toLowerCase();
  const Icon = (p === "twitter" || p === "x") ? TwitterLogoIcon
    : p === "reddit" ? RedditLogoIcon
    : p === "instagram" ? InstagramLogoIcon
    : p === "youtube" ? YoutubeLogo
    : GlobeIcon;
  return <Icon size={size} color={c} weight="fill" />;
}

function TypeBadge({ type, styles }: { type: string; styles: ReturnType<typeof makeStyles> }) {
  if (!type || type === "text") return null;
  return (
    <View style={styles.typeBadge}>
      <Text style={styles.typeBadgeText}>{type.toUpperCase()}</Text>
    </View>
  );
}

function InspirationCard({
  item, isSelected, onPress, onLongPress, onRemix, onDelete, styles,
}: any) {
  const theme = useTheme();
  let tags: string[] = [];
  try { tags = JSON.parse(item.tags || "[]"); } catch {}

  const meta = getPlatformMeta(item.sourcePlatform, theme.placeholderText);
  const hasImage = !!item.ogImage;

  if (hasImage) {
    return (
      <Pressable
        style={[styles.card, isSelected && { borderColor: theme.success, borderWidth: 2 }]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.ogImage }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={[styles.platformBadge, { backgroundColor: meta.color + "22", borderColor: meta.color + "44" }]}>
            <PlatformIcon platform={item.sourcePlatform} size={12} />
            <Text style={[styles.platformBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <TouchableOpacity style={styles.deleteOverlay} onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <TrashIcon size={14} color={theme.placeholderText} />
          </TouchableOpacity>
          {isSelected && (
            <View style={styles.selectedOverlay}>
              <CheckCircleIcon size={28} color={theme.success} weight="fill" />
            </View>
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || item.rawContent}
            </Text>
            <TypeBadge type={item.type} styles={styles} />
          </View>

          {item.summary ? (
            <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
          ) : null}

          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.slice(0, 3).map((t: string) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>#{t}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.remixBtnFull} onPress={onRemix}>
            <SparkleIcon size={14} color={theme.appBG} weight="fill" />
            <Text style={styles.remixBtnText}>Remix with AI</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.card,
        styles.cardNoImage,
        { borderLeftColor: isSelected ? theme.success : meta.color, borderLeftWidth: 4 },
        isSelected && { borderColor: theme.success, borderWidth: 2, borderLeftWidth: 4 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.platformRow}>
          <PlatformIcon platform={item.sourcePlatform} size={14} />
          <Text style={[styles.platformLabel, { color: meta.color }]}>{meta.label}</Text>
          <TypeBadge type={item.type} styles={styles} />
        </View>
        <View style={styles.headerRight}>
          {isSelected && <CheckCircleIcon size={16} color={theme.success} weight="fill" />}
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <TrashIcon size={14} color={theme.placeholderText} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={3}>
        {item.title || item.rawContent}
      </Text>

      {item.summary ? (
        <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
      ) : null}

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.slice(0, 3).map((t: string) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
          <SparkleIcon size={13} color={theme.appBG} weight="fill" />
          <Text style={styles.remixBtnText}>Remix</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

function AddContentModal({ visible, onClose, onAdded }: any) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<"url" | "text">("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("custom");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const qc = useQueryClient();

  useEffect(() => {
    if (mode !== "url") return;
    const detected = detectPlatformFromUrl(url);
    if (detected) setPlatform(detected);
  }, [url, mode]);

  async function handleAdd() {
    setLoading(true);
    setError("");
    try {
      let ogData: any = {};
      let rawContent = text;

      if (mode === "url") {
        if (!url) { setError("Enter a URL"); setLoading(false); return; }
        const res = await api.scrape.$post({ json: { url } });
        const data = await res.json();
        if ("title" in data) {
          ogData = data;
          rawContent = `${data.title}\n\n${data.description || ""}`;
        }
      }

      if (!rawContent.trim()) { setError("Enter some content"); setLoading(false); return; }

      const res = await api.inspirations.$post({
        json: {
          rawContent: rawContent.trim(),
          sourceUrl: mode === "url" ? url : null,
          sourcePlatform: platform,
          type: "text",
          title: ogData.title || null,
          ogImage: ogData.imageUrl || null,
        },
      });

      const data = await res.json();
      if (res.status === 403) {
        setError((data as any).message ?? "Limit reached");
        setLoading(false);
        return;
      }

      qc.invalidateQueries({ queryKey: ["inspirations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUrl(""); setText(""); setError("");
      onAdded();
      onClose();
    } catch {
      setError("Something went wrong");
    }
    setLoading(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Content</Text>
          <TouchableOpacity onPress={onClose}>
            <XIcon size={22} color={theme.textSupporting} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <View style={styles.modeToggle}>
            {(["url", "text"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === "url" ? "Paste URL" : "Paste Text"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {mode === "url" ? (
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={theme.placeholderText}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : (
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste a tweet, caption, post..."
              placeholderTextColor={theme.placeholderText}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          )}

          <Text style={styles.label}>Platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.chip, platform === p.value && styles.chipSelected]}
                  onPress={() => setPlatform(p.value)}
                >
                  <Text style={[styles.chipText, platform === p.value && styles.chipTextSelected]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.appBG} />
            ) : (
              <>
                <SparkleIcon size={18} color={theme.appBG} weight="fill" />
                <Text style={styles.addBtnText}>Add & Analyze with AI</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CanvasScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const { selectedIds, filter, setFilter, toggleSelect, clearSelection } = useCanvasStore();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["inspirations"],
    queryFn: async () => {
      const res = await api.inspirations.$get();
      const d = await res.json();
      return "inspirations" in d ? d.inspirations : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.inspirations[":id"].$delete({ param: { id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspirations"] }),
  });

  const inspirations = data ?? [];
  const filtered = filter === "all"
    ? inspirations
    : inspirations.filter((i: any) => i.type === filter || i.sourcePlatform === filter);

  function handleDelete(id: string) {
    Alert.alert("Delete", "Remove this inspiration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => { deleteMutation.mutate(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
      },
    ]);
  }

  function handleMerge() {
    if (selectedIds.length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push(`/merge?ids=${selectedIds.join(",")}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Canvas</Text>
        <TouchableOpacity
          style={styles.addIconBtn}
          onPress={() => { setModalVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <PlusIcon size={22} color={theme.appBG} weight="bold" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.success} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <TextTIcon size={48} color={theme.placeholderText} />
          <Text style={styles.emptyTitle}>No inspirations yet</Text>
          <Text style={styles.emptyText}>Tap + to add your first piece of content</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.success} />}
          renderItem={({ item }: any) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <InspirationCard
                item={item}
                isSelected={isSelected}
                styles={styles}
                onPress={() => {
                  if (selectedIds.length > 0) {
                    toggleSelect(item.id);
                    Haptics.selectionAsync();
                    return;
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/remix/${item.id}`);
                }}
                onLongPress={() => { toggleSelect(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                onRemix={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/remix/${item.id}`); }}
                onDelete={() => handleDelete(item.id)}
              />
            );
          }}
        />
      )}

      {/* Multi-select bar */}
      {selectedIds.length >= 2 && (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>✦ {selectedIds.length} selected</Text>
          <View style={styles.selectBarActions}>
            <TouchableOpacity onPress={clearSelection} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mergeBtn} onPress={handleMerge}>
              <ArrowsOutIcon size={16} color={theme.appBG} weight="bold" />
              <Text style={styles.mergeBtnText}>Merge →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AddContentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdded={() => {}}
      />
    </SafeAreaView>
  );
}
