import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  LightningIcon, BookmarkSimpleIcon, ArrowUpIcon, ChatCircleIcon,
  FileTextIcon, SparkleIcon,
} from "phosphor-react-native";
import { colors } from "../constants/colors";
import { getToken } from "../lib/auth";
import { api } from "../lib/api";
import { getApiBase } from "../lib/apiBase";

interface ContextComment {
  author: string;
  body: string;
  score: number;
  sourceUrl?: string;
}

interface ContextPost {
  title: string;
  url: string;
  score: number;
  platform: string;
  summary?: string;
}

type ContextMode = "reddit" | "x" | "xai" | "apify" | "ai";

interface ContextDebug {
  attempted?: string[];
  errors?: string[];
  fallbackReason?: "premium_required" | "daily_limit" | "all_live_sources_failed" | string;
}

interface ContextData {
  mode: ContextMode;
  comments: ContextComment[];
  relatedPosts: ContextPost[];
  debug?: ContextDebug;
  message?: string;
  error?: string;
}

function contextBannerText(mode: ContextMode): string | null {
  switch (mode) {
    case "xai":
      return "Live from X (Grok) · your subscription";
    case "apify":
      return "From X (Apify) · real posts";
    case "x":
      return "AI-surfaced perspectives · premium required for live X";
    case "ai":
      return "Simulated perspectives · live X unavailable";
    default:
      return null;
  }
}

interface Props {
  inspirationId: string;
  onAddFuel: (text: string) => void;
  onSaveToCanvas: (text: string, platform: string) => void;
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: "90%", marginTop: 8 }]} />
      <View style={[styles.skeletonLine, { width: "70%", marginTop: 6 }]} />
      <View style={[styles.skeletonLine, { width: "40%", marginTop: 12, height: 10 }]} />
    </View>
  );
}

function ScoreBadge({ score, mode }: { score: number; mode: ContextMode }) {
  if (score <= 0) {
    const hint = mode === "reddit" ? "Related angle" : mode === "xai" || mode === "apify" ? "Live" : "AI-surfaced";
    return (
      <View style={styles.scoreBadge}>
        <SparkleIcon size={10} color={colors.accentDim} />
        <Text style={styles.scoreText}>{hint}</Text>
      </View>
    );
  }
  return (
    <View style={styles.scoreBadge}>
      <ArrowUpIcon size={10} color={colors.textTertiary} />
      <Text style={styles.scoreText}>{score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score}</Text>
    </View>
  );
}

function ContextCard({
  item,
  type,
  mode,
  onAddFuel,
  onSaveToCanvas,
}: {
  item: ContextComment | ContextPost;
  type: "comment" | "post";
  mode: ContextMode;
  onAddFuel: (text: string) => void;
  onSaveToCanvas: (text: string, platform: string) => void;
}) {
  const isComment = type === "comment";
  const comment = item as ContextComment;
  const post = item as ContextPost;

  const title = isComment ? comment.author : post.title;
  const body = isComment ? comment.body : (post.summary ?? "");
  const score = isComment ? comment.score : post.score;
  const fuelText = isComment ? comment.body : `${post.title}${post.summary ? `\n\n${post.summary}` : ""}`;
  const canvasPlatform = isComment
    ? (mode === "reddit" ? "reddit" : "x")
    : (post.platform ?? "custom");
  const [expanded, setExpanded] = useState(false);
  const showExpand = isComment && body.length > 180;

  function handleFuel() {
    onAddFuel(fuelText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleSave() {
    onSaveToCanvas(fuelText, canvasPlatform);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardAuthor} numberOfLines={1}>{title}</Text>
        <ScoreBadge score={score} mode={mode} />
      </View>
      {body ? (
        <TouchableOpacity
          activeOpacity={showExpand ? 0.85 : 1}
          onPress={() => {
            if (!showExpand) return;
            setExpanded((prev) => !prev);
          }}
        >
          <Text style={styles.cardBody} numberOfLines={expanded ? undefined : 4}>{body}</Text>
          {showExpand ? (
            <Text style={styles.expandText}>{expanded ? "Show less" : "Tap to expand"}</Text>
          ) : null}
        </TouchableOpacity>
      ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.fuelBtn} onPress={handleFuel}>
          <LightningIcon size={13} color={colors.accent} weight="fill" />
          <Text style={styles.fuelBtnText}>Use as Fuel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <BookmarkSimpleIcon size={13} color={colors.textSecondary} />
          <Text style={styles.saveBtnText}>Save to Canvas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ContextTab({ inspirationId, onAddFuel, onSaveToCanvas }: Props) {
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getToken();
      const base = getApiBase();
      const res = await fetch(`${base}/api/inspirations/${inspirationId}/context`, {
        headers: { Authorization: token ?? "" },
      });
      const json = (await res.json()) as ContextData;
      if (!res.ok) {
        const msg = json.message ?? json.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load context";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [inspirationId]);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext])
  );

  async function handleSaveToCanvas(text: string, platform: string) {
    const key = text.slice(0, 40);
    if (savedIds.has(key)) return;
    setSavedIds((prev) => new Set(prev).add(key));
    try {
      await api.inspirations.$post({
        json: {
          rawContent: text,
          sourcePlatform: platform,
          type: "text",
        },
      });
      qc.invalidateQueries({ queryKey: ["inspirations"] });
      onSaveToCanvas(text, platform);
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data || (data.comments.length === 0 && data.relatedPosts.length === 0)) {
    return (
      <View style={styles.centered}>
        <FileTextIcon size={40} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No context available for this post</Text>
      </View>
    );
  }

  const isReddit = data.mode === "reddit";
  const commentsLabel = isReddit ? "Top Comments" : "Community Angles";
  const postsLabel = isReddit ? "Related Posts" : "Related Angles";
  const banner = contextBannerText(data.mode);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {banner && (
        <View style={styles.aiBanner}>
          <SparkleIcon size={12} color={colors.accentDim} />
          <Text style={styles.aiBannerText}>{banner}</Text>
        </View>
      )}

      {data.debug?.errors && data.debug.errors.length > 0 && (
        <View style={styles.debugBanner}>
          <Text style={styles.debugTitle}>
            {data.debug.fallbackReason === "premium_required"
              ? "Premium required for live X"
              : data.mode === "ai" || data.mode === "x"
                ? "Live X unavailable — showing fallback"
                : "Live X diagnostics"}
          </Text>
          {data.debug.errors.slice(0, 4).map((e, i) => (
            <Text key={i} style={styles.debugText}>• {e}</Text>
          ))}
          {data.debug.attempted && data.debug.attempted.length > 0 && (
            <Text style={styles.debugHint}>
              Tried: {data.debug.attempted.join(" → ")}
            </Text>
          )}
          <Text style={styles.debugHint}>Check API terminal for [XContext] logs</Text>
        </View>
      )}

      {data.comments.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <ChatCircleIcon size={14} color={colors.textSecondary} />
            <Text style={styles.sectionLabel}>{commentsLabel}</Text>
          </View>
          {data.comments.map((c, i) => (
            <ContextCard
              key={i}
              item={c}
              type="comment"
              mode={data.mode}
              onAddFuel={onAddFuel}
              onSaveToCanvas={handleSaveToCanvas}
            />
          ))}
        </>
      )}

      {data.relatedPosts.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <FileTextIcon size={14} color={colors.textSecondary} />
            <Text style={styles.sectionLabel}>{postsLabel}</Text>
          </View>
          {data.relatedPosts.map((p, i) => (
            <ContextCard
              key={i}
              item={p}
              type="post"
              mode={data.mode}
              onAddFuel={onAddFuel}
              onSaveToCanvas={handleSaveToCanvas}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },

  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  aiBannerText: { color: colors.textTertiary, fontSize: 11, flex: 1 },

  debugBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  debugText: { color: colors.textTertiary, fontSize: 10, lineHeight: 14 },
  debugHint: { color: colors.textTertiary, fontSize: 10, marginTop: 4, fontStyle: "italic" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardAuthor: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", flex: 1 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  scoreText: { color: colors.textTertiary, fontSize: 11 },
  cardBody: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  expandText: { color: colors.accentDim, fontSize: 11, marginTop: 6, fontWeight: "600" },

  cardActions: { flexDirection: "row", gap: 8, marginTop: 2 },
  fuelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fuelBtnText: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtnText: { color: colors.textSecondary, fontSize: 12 },

  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  skeletonLine: {
    height: 14,
    width: "100%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
  },
});
