import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  BookmarkSimpleIcon, SparkleIcon, TrashIcon, CopyIcon,
  GlobeIcon,
} from "phosphor-react-native";

const TABS = ["Inspirations", "Remixes"] as const;
type Tab = (typeof TABS)[number];

function InspirationRow({ item, onDelete }: any) {
  let tags: string[] = [];
  try { tags = JSON.parse(item.tags || "[]"); } catch {}
  const router = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <GlobeIcon size={14} color={colors.textTertiary} />
        <Text style={styles.rowPlatform}>{item.sourcePlatform}</Text>
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>{item.title || item.rawContent}</Text>
      {item.summary ? <Text style={styles.rowSummary} numberOfLines={1}>{item.summary}</Text> : null}
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.slice(0, 3).map((t: string) => (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>
          ))}
        </View>
      )}
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/remix/${item.id}`); }}
        >
          <SparkleIcon size={14} color={colors.accent} />
          <Text style={styles.actionBtnText}>Remix</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <TrashIcon size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RemixRow({ item, onDelete }: any) {
  let variations: any[] = [];
  try { variations = JSON.parse(item.variations || "[]"); } catch {}
  const content = variations[0]?.content || item.outputContent;

  async function copyAll() {
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.outputType.replace("merged_", "")}</Text>
        </View>
        {item.platform && <Text style={styles.rowPlatform}>{item.platform}</Text>}
      </View>
      <Text style={styles.rowTitle} numberOfLines={3}>{content}</Text>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={copyAll}>
          <CopyIcon size={14} color={colors.accent} />
          <Text style={styles.actionBtnText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <TrashIcon size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("Inspirations");
  const qc = useQueryClient();

  const inspirations = useQuery({
    queryKey: ["inspirations"],
    queryFn: async () => {
      const res = await api.inspirations.$get();
      const d = await res.json();
      return "inspirations" in d ? d.inspirations : [];
    },
  });

  const remixes = useQuery({
    queryKey: ["remixes"],
    queryFn: async () => {
      const res = await api.remixes.$get();
      const d = await res.json();
      return "remixes" in d ? d.remixes : [];
    },
  });

  const deleteInspiration = useMutation({
    mutationFn: async (id: string) => api.inspirations[":id"].$delete({ param: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspirations"] }),
  });

  const deleteRemix = useMutation({
    mutationFn: async (id: string) => api.remixes[":id"].$delete({ param: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remixes"] }),
  });

  const isLoading = activeTab === "Inspirations" ? inspirations.isLoading : remixes.isLoading;
  const data = (activeTab === "Inspirations" ? inspirations.data : remixes.data) ?? [];

  function confirmDelete(id: string, type: Tab) {
    Alert.alert("Delete", `Remove this ${type === "Inspirations" ? "inspiration" : "remix"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          if (type === "Inspirations") deleteInspiration.mutate(id);
          else deleteRemix.mutate(id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centered}>
          <BookmarkSimpleIcon size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            {activeTab === "Inspirations" ? "Add content from the Canvas tab" : "Generate remixes from your inspirations"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: any) =>
            activeTab === "Inspirations" ? (
              <InspirationRow item={item} onDelete={() => confirmDelete(item.id, "Inspirations")} />
            ) : (
              <RemixRow item={item} onDelete={() => confirmDelete(item.id, "Remixes")} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { ...typography.displayMedium, color: colors.textPrimary },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
  tabTextActive: { color: colors.background, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { ...typography.heading, color: colors.textSecondary },
  emptyText: { ...typography.caption, color: colors.textTertiary, textAlign: "center", paddingHorizontal: 32 },
  list: { padding: 16, gap: 12 },
  row: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowPlatform: { color: colors.textTertiary, fontSize: 11, fontWeight: "500" },
  rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  rowSummary: { color: colors.textSecondary, fontSize: 12 },
  tagRow: { flexDirection: "row", gap: 6 },
  tag: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  tagText: { color: colors.textTertiary, fontSize: 10 },
  rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  badge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
});
