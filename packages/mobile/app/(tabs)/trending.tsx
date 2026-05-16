import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, ScrollView,
} from "react-native";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  RedditLogoIcon, NewspaperIcon, FlameIcon, ArrowSquareOutIcon,
  SparkleIcon, PlusIcon,
} from "phosphor-react-native";

const NICHES = ["tech", "finance", "fitness", "beauty", "food", "gaming", "travel", "fashion", "business", "crypto", "lifestyle", "sports"];

function TrendCard({ item, onAddToCanvas, onRemix }: any) {
  const isReddit = item.platform === "reddit";
  const PlatformIcon = isReddit ? RedditLogoIcon : NewspaperIcon;
  const platformColor = isReddit ? colors.reddit : colors.news;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.platformRow}>
          <PlatformIcon size={16} color={platformColor} weight="fill" />
          <Text style={[styles.platformLabel, { color: platformColor }]}>
            {item.platform === "reddit" ? "Reddit" : "News"}
          </Text>
        </View>
        {item.engagementScore > 0 && (
          <View style={styles.scoreBadge}>
            <FlameIcon size={12} color={colors.warning} weight="fill" />
            <Text style={styles.scoreText}>{(item.engagementScore / 1000).toFixed(1)}k</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
      {item.summary ? <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text> : null}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.addBtn} onPress={onAddToCanvas}>
          <PlusIcon size={14} color={colors.accent} weight="bold" />
          <Text style={styles.addBtnText}>Add to Canvas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
          <SparkleIcon size={14} color={colors.background} weight="fill" />
          <Text style={styles.remixBtnText}>Remix</Text>
        </TouchableOpacity>
        {item.url && (
          <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
            <ArrowSquareOutIcon size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function TrendingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedNiche, setSelectedNiche] = useState("tech");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["trends", selectedNiche],
    queryFn: async () => {
      const res = await api.trends.$get({ query: { niche: selectedNiche } });
      const d = await res.json() as any;
      if (d && Array.isArray(d.trends)) return d.trends as any[];
      return [] as any[];
    },
  });

  const addToCanvas = useMutation({
    mutationFn: async (item: any) => {
      await api.inspirations.$post({
        json: {
          rawContent: `${item.title}\n\n${item.summary || ""}`,
          sourceUrl: item.url,
          sourcePlatform: item.platform,
          type: "text",
          title: item.title,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspirations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const trends = data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Trends</Text>
        <TouchableOpacity onPress={() => { refetch(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Niche filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nichesScroll} contentContainerStyle={styles.nichesContent}>
        {NICHES.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.nicheChip, selectedNiche === n && styles.nicheChipActive]}
            onPress={() => { setSelectedNiche(n); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.nicheChipText, selectedNiche === n && styles.nicheChipTextActive]}>
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Fetching trends...</Text>
        </View>
      ) : trends.length === 0 ? (
        <View style={styles.centered}>
          <FlameIcon size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No trends found</Text>
          <Text style={styles.emptyText}>Try refreshing or switching niche</Text>
        </View>
      ) : (
        <FlatList
          data={trends}
          keyExtractor={(item: any) => item.id ?? item.url ?? Math.random().toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
          renderItem={({ item }: any) => (
            <TrendCard
              item={item}
              onAddToCanvas={() => addToCanvas.mutate(item)}
              onRemix={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Add to canvas first, then open remix
                const res = await api.inspirations.$post({
                  json: {
                    rawContent: `${item.title}\n\n${item.summary || ""}`,
                    sourceUrl: item.url,
                    sourcePlatform: item.platform,
                    type: "text",
                    title: item.title,
                  },
                });
                const d = await res.json();
                if ("inspiration" in d) {
                  qc.invalidateQueries({ queryKey: ["inspirations"] });
                  router.push(`/remix/${d.inspiration.id}`);
                }
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { ...typography.displayMedium, color: colors.textPrimary },
  refreshText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  nichesScroll: { flexGrow: 0 },
  nichesContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  nicheChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  nicheChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  nicheChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  nicheChipTextActive: { color: colors.background, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyTitle: { ...typography.heading, color: colors.textSecondary },
  emptyText: { ...typography.caption, color: colors.textTertiary },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  platformRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  platformLabel: { fontSize: 12, fontWeight: "600" },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  scoreText: { color: colors.warning, fontSize: 11, fontWeight: "600" },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  cardSummary: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  remixBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  remixBtnText: { color: colors.background, fontSize: 13, fontWeight: "700" },
});
