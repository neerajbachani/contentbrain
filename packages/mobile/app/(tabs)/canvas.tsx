import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator,
  ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { useCanvasStore } from "../../store/canvasStore";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  PlusIcon, TwitterLogoIcon, RedditLogoIcon, InstagramLogoIcon,
  GlobeIcon, TextTIcon, TrashIcon, ArrowsOutIcon, SparkleIcon,
  XIcon,
} from "phosphor-react-native";

const FILTERS = ["all", "tweet", "reel", "reddit", "blog", "text", "url"] as const;

const PLATFORMS = [
  { label: "Twitter/X", value: "twitter" },
  { label: "Instagram", value: "instagram" },
  { label: "Reddit", value: "reddit" },
  { label: "YouTube", value: "youtube" },
  { label: "Blog", value: "blog" },
  { label: "Custom", value: "custom" },
];

function detectPlatformFromUrl(value: string): string | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("twitter.com") || normalized.includes("x.com")) return "twitter";
  if (normalized.includes("reddit.com")) return "reddit";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "youtube";
  if (normalized.includes("instagram.com")) return "instagram";
  return null;
}

function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const c = { twitter: colors.twitter, reddit: colors.reddit, instagram: colors.instagram }[platform] ?? colors.textSecondary;
  const Icon = platform === "twitter" ? TwitterLogoIcon
    : platform === "reddit" ? RedditLogoIcon
    : platform === "instagram" ? InstagramLogoIcon
    : GlobeIcon;
  return <Icon size={size} color={c} weight="fill" />;
}

function InspirationCard({
  item, isSelected, onPress, onLongPress, onRemix, onDelete,
}: any) {
  let tags: string[] = [];
  try { tags = JSON.parse(item.tags || "[]"); } catch {}

  return (
    <Pressable
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {item.ogImage ? (
        <Image source={{ uri: item.ogImage }} style={styles.cardImage} resizeMode="cover" />
      ) : null}

      <View style={styles.cardHeader}>
        <View style={styles.platformRow}>
          <PlatformIcon platform={item.sourcePlatform} />
          <Text style={styles.platformLabel}>{item.sourcePlatform}</Text>
        </View>
        <TouchableOpacity onPress={onDelete}>
          <TrashIcon size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title || item.rawContent}
      </Text>

      {item.summary ? (
        <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
      ) : null}

      {tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tagRow}>
            {tags.slice(0, 4).map((t: string) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
          <SparkleIcon size={14} color={colors.background} weight="fill" />
          <Text style={styles.remixBtnText}>Remix</Text>
        </TouchableOpacity>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓ Selected</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function AddContentModal({ visible, onClose, onAdded }: any) {
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
    if (detected) {
      setPlatform(detected);
    }
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
        style={{ flex: 1, backgroundColor: colors.surface }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Content</Text>
          <TouchableOpacity onPress={onClose}>
            <XIcon size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Mode toggle */}
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
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <SparkleIcon size={18} color={colors.background} weight="fill" />
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
  const filtered = filter === "all" ? inspirations : inspirations.filter((i: any) => i.type === filter || i.sourcePlatform === filter);

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
          <PlusIcon size={22} color={colors.background} weight="bold" />
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
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <TextTIcon size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No inspirations yet</Text>
          <Text style={styles.emptyText}>Tap + to add your first piece of content</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
          renderItem={({ item }: any) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <InspirationCard
                item={item}
                isSelected={isSelected}
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
              <ArrowsOutIcon size={16} color={colors.background} weight="bold" />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { ...typography.displayMedium, color: colors.textPrimary },
  addIconBtn: { backgroundColor: colors.accent, width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  filtersScroll: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  filterChipTextActive: { color: colors.background, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { ...typography.heading, color: colors.textSecondary },
  emptyText: { ...typography.caption, color: colors.textTertiary, textAlign: "center" },
  grid: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  cardImage: { width: "100%", height: 110, borderRadius: 12, backgroundColor: colors.surfaceElevated },
  cardSelected: { borderColor: colors.accent, borderWidth: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  platformRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  platformLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: "500" },
  cardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardSummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  tagRow: { flexDirection: "row", gap: 6 },
  tag: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  tagText: { color: colors.textTertiary, fontSize: 10 },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  remixBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  remixBtnText: { color: colors.background, fontSize: 12, fontWeight: "700" },
  selectedBadge: { backgroundColor: colors.accentDim + "33", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  selectedBadgeText: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  selectBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surfaceElevated, borderTopWidth: 1, borderTopColor: colors.border, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectBarText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  selectBarActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { color: colors.textSecondary, fontSize: 14 },
  mergeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  mergeBtnText: { color: colors.background, fontWeight: "700", fontSize: 14 },
  // Modal
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading, color: colors.textPrimary },
  modalBody: { padding: 20, gap: 16 },
  modeToggle: { flexDirection: "row", backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: colors.accent },
  modeBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
  modeBtnTextActive: { color: colors.background, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13, backgroundColor: "#EF444420", padding: 10, borderRadius: 8 },
  input: { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, padding: 14, borderRadius: 12, fontSize: 15 },
  textArea: { height: 120 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextSelected: { color: colors.background, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent, padding: 16, borderRadius: 12, marginTop: 8 },
  addBtnText: { color: colors.background, fontWeight: "700", fontSize: 16 },
});
