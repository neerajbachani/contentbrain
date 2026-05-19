import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, ScrollView, Image,
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
  SparkleIcon, PlusIcon, CaretDownIcon, CaretUpIcon,
} from "phosphor-react-native";
import { XLogoIcon } from "../../components/XLogoIcon";

const NICHES = ["tech", "finance", "fitness", "beauty", "food", "gaming", "travel", "fashion", "business", "crypto", "lifestyle", "sports"];

type TrendRow = {
  id?: string;
  platform: string;
  platformDisplay?: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  author?: string | null;
  engagementScore?: number | null;
};

type TodayXNewsGroup = {
  headline: TrendRow;
  relatedPosts: TrendRow[];
};

function urlDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^\s*[-*•]\s+/gm, "").trim();
}

function displaySummary(item: TrendRow): string | null {
  const raw = item.summary?.trim();
  if (raw) return stripMarkdown(raw);
  if (item.platform === "x") {
    const domain = urlDomain(item.url);
    const author = item.author?.trim();
    if (author && domain && author !== "X") return `${author} · ${domain}`;
    if (domain) return `Post on ${domain}`;
    if (author && author !== "X") return author;
  }
  return null;
}

function formatEngagement(score?: number | null): string | null {
  if (!score || score <= 0) return null;
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return String(score);
}

function TrendCard({
  item,
  onAddToCanvas,
  onRemix,
  compact = false,
}: {
  item: TrendRow;
  onAddToCanvas: () => void;
  onRemix: () => void;
  compact?: boolean;
}) {
  const isReddit = item.platform === "reddit";
  const isX = item.platform === "x";
  const platformColor = isReddit ? colors.reddit : isX ? colors.textPrimary : colors.news;
  const platformLabel =
    item.platformDisplay ?? (isReddit ? "Reddit" : isX ? "X" : "News");
  const summary = displaySummary(item);
  const engagement = formatEngagement(item.engagementScore);

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={[styles.thumbnail, compact && styles.thumbnailCompact]}
          resizeMode="cover"
          accessibilityLabel="Post preview"
        />
      ) : null}

      <View style={[styles.cardBody, !item.thumbnailUrl && styles.cardBodyNoPad]}>
        <View style={styles.cardTop}>
          <View style={styles.platformRow}>
            {isX ? (
              <XLogoIcon size={16} color={platformColor} />
            ) : isReddit ? (
              <RedditLogoIcon size={16} color={platformColor} weight="fill" />
            ) : (
              <NewspaperIcon size={16} color={platformColor} weight="fill" />
            )}
            <Text style={[styles.platformLabel, { color: platformColor }]}>
              {platformLabel}
            </Text>
          </View>
          {engagement ? (
            <View style={styles.scoreBadge}>
              <FlameIcon size={12} color={colors.warning} weight="fill" />
              <Text style={styles.scoreText}>{engagement}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={compact ? 2 : 3}>
          {stripMarkdown(item.title)}
        </Text>
        {summary ? (
          <Text style={styles.cardSummary} numberOfLines={compact ? 2 : 2}>
            {summary}
          </Text>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.addBtn} onPress={onAddToCanvas}>
            <PlusIcon size={14} color={colors.accent} weight="bold" />
            <Text style={styles.addBtnText}>Add to Canvas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
            <SparkleIcon size={14} color={colors.background} weight="fill" />
            <Text style={styles.remixBtnText}>Remix</Text>
          </TouchableOpacity>
          {item.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(item.url!)}>
              <ArrowSquareOutIcon size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function TodayXNewsSection({
  groups,
  onAddToCanvas,
  onRemix,
}: {
  groups: TodayXNewsGroup[];
  onAddToCanvas: (item: TrendRow) => void;
  onRemix: (item: TrendRow) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });

  if (!groups.length) return null;

  return (
    <View style={styles.todaySection}>
      <View style={styles.todayHeader}>
        <XLogoIcon size={18} color={colors.textPrimary} />
        <Text style={styles.todayTitle}>Today&apos;s X News</Text>
      </View>

      {groups.map((group, idx) => {
        const isOpen = expanded[idx] ?? false;
        return (
          <View key={group.headline.url ?? group.headline.id ?? idx} style={styles.todayGroup}>
            <TouchableOpacity
              style={styles.todayHeadlineRow}
              onPress={() => {
                setExpanded((e) => ({ ...e, [idx]: !isOpen }));
                Haptics.selectionAsync();
              }}
            >
              <Text style={styles.todayHeadline} numberOfLines={2}>
                {stripMarkdown(group.headline.title)}
              </Text>
              {isOpen ? (
                <CaretUpIcon size={18} color={colors.textSecondary} />
              ) : (
                <CaretDownIcon size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {isOpen ? (
              <View style={styles.relatedList}>
                {group.relatedPosts.length === 0 ? (
                  <TrendCard
                    item={group.headline}
                    compact
                    onAddToCanvas={() => onAddToCanvas(group.headline)}
                    onRemix={() => onRemix(group.headline)}
                  />
                ) : null}
                {group.relatedPosts.map((rel, rIdx) => (
                  <TrendCard
                    key={rel.url ?? rel.id ?? rIdx}
                    item={rel}
                    compact
                    onAddToCanvas={() => onAddToCanvas(rel)}
                    onRemix={() => onRemix(rel)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
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
      if (res.status === 403 && d?.limitReached) {
        return {
          trends: [] as TrendRow[],
          todayXNews: [] as TodayXNewsGroup[],
          limitReached: true,
          message: d.message ?? "Daily trend limit reached. Upgrade to Premium.",
        };
      }
      return {
        trends: (d?.trends ?? []) as TrendRow[],
        todayXNews: (d?.todayXNews ?? []) as TodayXNewsGroup[],
        limitReached: false,
        message: "",
      };
    },
  });

  const addToCanvas = useMutation({
    mutationFn: async (item: TrendRow) => {
      await api.inspirations.$post({
        json: {
          rawContent: `${stripMarkdown(item.title)}\n\n${displaySummary(item) || ""}`,
          sourceUrl: item.url,
          sourcePlatform: item.platform,
          type: "text",
          title: stripMarkdown(item.title),
          ogImage: item.thumbnailUrl ?? null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspirations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleRemix = async (item: TrendRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await api.inspirations.$post({
      json: {
        rawContent: `${stripMarkdown(item.title)}\n\n${displaySummary(item) || ""}`,
        sourceUrl: item.url,
        sourcePlatform: item.platform,
        type: "text",
        title: stripMarkdown(item.title),
        ogImage: item.thumbnailUrl ?? null,
      },
    });
    const d = await res.json();
    if ("inspiration" in d) {
      qc.invalidateQueries({ queryKey: ["inspirations"] });
      router.push(`/remix/${d.inspiration.id}`);
    }
  };

  const trends = data?.trends ?? [];
  const todayXNews = data?.todayXNews ?? [];
  const limitReached = data?.limitReached ?? false;
  const limitMessage = data?.message ?? "Daily trend limit reached. Upgrade to Premium.";

  const ListHeader = (
    <>
      <TodayXNewsSection
        groups={todayXNews}
        onAddToCanvas={(item) => addToCanvas.mutate(item)}
        onRemix={handleRemix}
      />
      {todayXNews.length > 0 ? (
        <Text style={styles.sectionLabel}>Niche Trends</Text>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today&apos;s Trends</Text>
        <TouchableOpacity onPress={() => { refetch(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

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

      {limitReached ? (
        <View style={styles.limitBanner}>
          <Text style={styles.limitBannerTitle}>Daily trend limit reached</Text>
          <Text style={styles.limitBannerText}>{limitMessage}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Fetching trends...</Text>
        </View>
      ) : trends.length === 0 && todayXNews.length === 0 && !limitReached ? (
        <View style={styles.centered}>
          <FlameIcon size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No trends found</Text>
          <Text style={styles.emptyText}>Try refreshing or switching niche</Text>
        </View>
      ) : (
        <FlatList
          data={trends}
          keyExtractor={(item) =>
            item.url ?? item.id ?? `${item.platform}-${item.title}`
          }
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />}
          renderItem={({ item }) => (
            <TrendCard
              item={item}
              onAddToCanvas={() => addToCanvas.mutate(item)}
              onRemix={() => handleRemix(item)}
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
  limitBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#F59E0B1A",
    borderWidth: 1,
    borderColor: "#F59E0B66",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  limitBannerTitle: { color: colors.warning, fontSize: 13, fontWeight: "700" },
  limitBannerText: { color: colors.textSecondary, fontSize: 12 },
  nicheChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  nicheChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  nicheChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  nicheChipTextActive: { color: colors.background, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyTitle: { ...typography.heading, color: colors.textSecondary },
  emptyText: { ...typography.caption, color: colors.textTertiary },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  todaySection: {
    marginBottom: 16,
    gap: 10,
  },
  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  todayTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  todayGroup: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  todayHeadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  todayHeadline: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  relatedList: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cardCompact: { borderRadius: 12 },
  thumbnail: { width: "100%", height: 160, backgroundColor: colors.surfaceElevated },
  thumbnailCompact: { height: 120 },
  cardBody: { padding: 14, gap: 8 },
  cardBodyNoPad: { paddingTop: 14 },
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
