import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { apiRequest, formatApiError } from "../../lib/http";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  BookmarkSimpleIcon, SparkleIcon, TrashIcon, CopyIcon,
  GlobeIcon,
} from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";

const TABS = ["Inspirations", "Remixes"] as const;
type Tab = (typeof TABS)[number];

function primaryInspirationId(item: { inspirationIds?: string }): string | null {
  try {
    const ids = JSON.parse(item.inspirationIds || "[]");
    return Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
  } catch {
    return null;
  }
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBG },
    header: { paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { ...typography.displayMedium, color: theme.text },
    tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
    tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: theme.border },
    tabActive: { backgroundColor: theme.success, borderColor: theme.success },
    tabText: { color: theme.textSupporting, fontSize: 14, fontWeight: "500" },
    tabTextActive: { color: theme.appBG, fontWeight: "700" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyTitle: { ...typography.heading, color: theme.textSupporting },
    emptyText: { ...typography.caption, color: theme.placeholderText, textAlign: "center", paddingHorizontal: 32 },
    list: { padding: 16, gap: 12 },
    row: { backgroundColor: theme.cardBG, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 8 },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowPlatform: { color: theme.placeholderText, fontSize: 11, fontWeight: "500" },
    rowTitle: { color: theme.text, fontSize: 14, fontWeight: "600", lineHeight: 20 },
    rowSummary: { color: theme.textSupporting, fontSize: 12 },
    tagRow: { flexDirection: "row", gap: 6 },
    tag: { backgroundColor: theme.highlightBG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
    tagText: { color: theme.placeholderText, fontSize: 10 },
    rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: theme.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
    actionBtnText: { color: theme.success, fontSize: 13, fontWeight: "600" },
    badge: { backgroundColor: theme.highlightBG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { color: theme.textSupporting, fontSize: 11, fontWeight: "600" },
    errorText: { color: theme.danger, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  });
}

function InspirationRow({ item, onDelete }: any) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  let tags: string[] = [];
  try { tags = JSON.parse(item.tags || "[]"); } catch {}
  const router = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <GlobeIcon size={14} color={theme.placeholderText} />
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
          <SparkleIcon size={14} color={theme.success} />
          <Text style={styles.actionBtnText}>Remix</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <TrashIcon size={16} color={theme.placeholderText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RemixRow({ item, onDelete }: any) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  let variations: any[] = [];
  try { variations = JSON.parse(item.variations || "[]"); } catch {}
  const idx =
    typeof item.selectedVariationIndex === "number" ? item.selectedVariationIndex : 0;
  const content = variations[idx]?.content || item.outputContent;

  async function copyAll() {
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function openInStudio() {
    const inspirationId = primaryInspirationId(item);
    if (!inspirationId) {
      Alert.alert("Cannot open", "No linked inspiration for this remix.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/remix/${inspirationId}?remixId=${item.id}`);
  }

  return (
    <TouchableOpacity style={styles.row} onPress={openInStudio} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.outputType.replace("merged_", "")}</Text>
        </View>
        {item.platform && <Text style={styles.rowPlatform}>{item.platform}</Text>}
      </View>
      <Text style={styles.rowTitle} numberOfLines={3}>{content}</Text>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={copyAll}>
          <CopyIcon size={14} color={theme.success} />
          <Text style={styles.actionBtnText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete}>
          <TrashIcon size={16} color={theme.placeholderText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [activeTab, setActiveTab] = useState<Tab>("Inspirations");
  const qc = useQueryClient();

  const inspirations = useQuery({
    queryKey: ["inspirations"],
    queryFn: async () => {
      const d = await apiRequest<{ inspirations: any[] }>("GET", "/api/inspirations", () =>
        api.inspirations.$get()
      );
      return "inspirations" in d ? d.inspirations : [];
    },
  });

  const remixes = useQuery({
    queryKey: ["remixes"],
    queryFn: async () => {
      const d = await apiRequest<{ remixes: any[] }>("GET", "/api/remixes", () =>
        api.remixes.$get()
      );
      return "remixes" in d ? d.remixes : [];
    },
  });

  const deleteInspiration = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/inspirations/${id}`, () =>
        api.inspirations[":id"].$delete({ param: { id } })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspirations"] }),
    onError: (err) => Alert.alert("Delete failed", formatApiError(err, "Could not delete inspiration")),
  });

  const deleteRemix = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/remixes/${id}`, () =>
        api.remixes[":id"].$delete({ param: { id } })
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remixes"] }),
    onError: (err) => Alert.alert("Delete failed", formatApiError(err, "Could not delete remix")),
  });

  const isLoading = activeTab === "Inspirations" ? inspirations.isLoading : remixes.isLoading;
  const data = (activeTab === "Inspirations" ? inspirations.data : remixes.data) ?? [];
  const activeError = activeTab === "Inspirations" ? inspirations.error : remixes.error;
  const errorMessage = activeError ? formatApiError(activeError, `Could not load ${activeTab.toLowerCase()}`) : "";

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
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.success} />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centered}>
          <BookmarkSimpleIcon size={48} color={theme.placeholderText} />
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
