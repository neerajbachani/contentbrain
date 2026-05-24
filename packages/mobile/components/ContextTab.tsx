import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  LightningIcon, BookmarkSimpleIcon, ArrowUpIcon, ChatCircleIcon,
  FileTextIcon, SparkleIcon,
} from "phosphor-react-native";
import { getToken } from "../lib/auth";
import { api } from "../lib/api";
import { getApiBase } from "../lib/apiBase";
import { useTheme, useThemedStyles } from "../theme";
import { colors as paletteColors } from "../theme/colors";
import { variables } from "../theme/variables";
import { Text } from "./ui";
import type { ThemeColors } from "../theme/types";

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
  thumbnailUrl?: string;
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
  onSaveToCanvas: (text: string, platform: string, sourceUrl?: string) => void;
}

function makeContextStyles(theme: ThemeColors) {
  return {
    content: { padding: variables.spacing4, gap: 10 },
    centered: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, paddingTop: 80, gap: variables.spacing3 },
    errorText: { color: theme.textError, fontSize: variables.fontSizeLabel, textAlign: "center" as const },
    emptyText: { color: theme.textSupporting, fontSize: variables.fontSizeNormal, textAlign: "center" as const },
    aiBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      backgroundColor: theme.highlightBG,
      borderRadius: variables.componentBorderRadius,
      paddingHorizontal: variables.spacing3,
      paddingVertical: variables.spacing2,
      marginBottom: 4,
    },
    aiBannerText: { color: theme.placeholderText, fontSize: 11, flex: 1 },
    debugBanner: {
      backgroundColor: theme.highlightBG,
      borderRadius: variables.componentBorderRadius,
      padding: 10,
      gap: 4,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    debugTitle: { color: theme.textSupporting, fontSize: 11, fontWeight: "600" as const },
    debugText: { color: theme.placeholderText, fontSize: 10, lineHeight: 14 },
    debugHint: { color: theme.placeholderText, fontSize: 10, marginTop: 4, fontStyle: "italic" as const },
    sectionHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 4, marginBottom: 2 },
    sectionLabel: {
      color: theme.textSupporting,
      fontSize: 12,
      fontWeight: "600" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: theme.cardBG,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden" as const,
      gap: 0,
    },
    cardInner: {
      padding: 14,
      gap: variables.spacing2,
    },
    cardThumbnail: {
      width: "100%" as const,
      height: 100,
      backgroundColor: theme.highlightBG,
    },
    cardHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: variables.spacing2 },
    cardAuthor: { color: theme.textSupporting, fontSize: 12, fontWeight: "600" as const, flex: 1 },
    scoreBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 3 },
    scoreText: { color: theme.placeholderText, fontSize: 11 },
    cardBody: { color: theme.text, fontSize: variables.fontSizeNormal, lineHeight: 20 },
    expandText: { color: paletteColors.green600, fontSize: 11, marginTop: 6, fontWeight: "600" as const },
    cardActions: { flexDirection: "row" as const, gap: variables.spacing2, marginTop: 2 },
    fuelBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: variables.spacing3,
      paddingVertical: 7,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.success,
    },
    fuelBtnText: { color: theme.success, fontSize: 12, fontWeight: "600" as const },
    saveBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 5,
      paddingHorizontal: variables.spacing3,
      paddingVertical: 7,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.border,
    },
    saveBtnText: { color: theme.textSupporting, fontSize: 12 },
    skeletonCard: {
      backgroundColor: theme.cardBG,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    skeletonLine: {
      height: 14,
      width: "100%" as const,
      backgroundColor: theme.highlightBG,
      borderRadius: 6,
    },
  };
}

function SkeletonCard({ styles }: { styles: ReturnType<typeof makeContextStyles> }) {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: "90%", marginTop: 8 }]} />
      <View style={[styles.skeletonLine, { width: "70%", marginTop: 6 }]} />
      <View style={[styles.skeletonLine, { width: "40%", marginTop: 12, height: 10 }]} />
    </View>
  );
}

function ScoreBadge({
  score,
  mode,
  styles,
}: {
  score: number;
  mode: ContextMode;
  styles: ReturnType<typeof makeContextStyles>;
}) {
  const theme = useTheme();
  if (score <= 0) {
    const hint = mode === "reddit" ? "Related angle" : mode === "xai" || mode === "apify" ? "Live" : "AI-surfaced";
    return (
      <View style={styles.scoreBadge}>
        <SparkleIcon size={10} color={paletteColors.green600} />
        <Text style={styles.scoreText}>{hint}</Text>
      </View>
    );
  }
  return (
    <View style={styles.scoreBadge}>
      <ArrowUpIcon size={10} color={theme.placeholderText} />
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
  styles,
}: {
  item: ContextComment | ContextPost;
  type: "comment" | "post";
  mode: ContextMode;
  onAddFuel: (text: string) => void;
  onSaveToCanvas: (text: string, platform: string, sourceUrl?: string) => void;
  styles: ReturnType<typeof makeContextStyles>;
}) {
  const theme = useTheme();
  const isComment = type === "comment";
  const comment = item as ContextComment;
  const post = item as ContextPost;

  const title = isComment ? comment.author : post.title;
  const body = isComment ? comment.body : (post.summary ?? "");
  const score = isComment ? comment.score : post.score;
  const fuelText = isComment ? comment.body : `${post.title}${post.summary ? `\n\n${post.summary}` : ""}`;
  const canvasPlatform = isComment ? (mode === "reddit" ? "reddit" : "x") : (post.platform ?? "custom");
  const [expanded, setExpanded] = useState(false);
  const showExpand = isComment && body.length > 180;
  const thumbnailUrl = !isComment ? post.thumbnailUrl?.trim() : undefined;

  function handleFuel() {
    onAddFuel(fuelText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleSave() {
    const postUrl = !isComment ? post.url : undefined;
    onSaveToCanvas(fuelText, canvasPlatform, postUrl);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.card}>
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.cardThumbnail}
          resizeMode="cover"
          accessibilityLabel="Post preview"
        />
      ) : null}
      <View style={styles.cardInner}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {title}
          </Text>
          <ScoreBadge score={score} mode={mode} styles={styles} />
        </View>
        {body ? (
          <TouchableOpacity
            activeOpacity={showExpand ? 0.85 : 1}
            onPress={() => {
              if (!showExpand) return;
              setExpanded((prev) => !prev);
            }}
          >
            <Text style={styles.cardBody} numberOfLines={expanded ? undefined : 4}>
              {body}
            </Text>
            {showExpand ? (
              <Text style={styles.expandText}>{expanded ? "Show less" : "Tap to expand"}</Text>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.fuelBtn} onPress={handleFuel}>
            <LightningIcon size={13} color={theme.success} weight="fill" />
            <Text style={styles.fuelBtnText}>Use as Fuel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <BookmarkSimpleIcon size={13} color={theme.textSupporting} />
            <Text style={styles.saveBtnText}>Save to Canvas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ContextTab({ inspirationId, onAddFuel, onSaveToCanvas }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeContextStyles);
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

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  async function handleSaveToCanvas(text: string, platform: string, sourceUrl?: string) {
    const key = text.slice(0, 40);
    if (savedIds.has(key)) return;
    setSavedIds((prev) => new Set(prev).add(key));
    try {
      await api.inspirations.$post({
        json: {
          rawContent: text,
          sourcePlatform: platform,
          sourceUrl: sourceUrl ?? null,
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
        <SkeletonCard styles={styles} />
        <SkeletonCard styles={styles} />
        <SkeletonCard styles={styles} />
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
        <FileTextIcon size={40} color={theme.placeholderText} />
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
          <SparkleIcon size={12} color={paletteColors.green600} />
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
            <Text key={i} style={styles.debugText}>
              • {e}
            </Text>
          ))}
          {data.debug.attempted && data.debug.attempted.length > 0 && (
            <Text style={styles.debugHint}>Tried: {data.debug.attempted.join(" → ")}</Text>
          )}
          <Text style={styles.debugHint}>Check API terminal for [XContext] logs</Text>
        </View>
      )}

      {data.comments.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <ChatCircleIcon size={14} color={theme.textSupporting} />
            <Text style={styles.sectionLabel}>{commentsLabel}</Text>
          </View>
          {data.comments.map((c, i) => (
            <ContextCard
              key={i}
              item={c}
              type="comment"
              mode={data.mode}
              styles={styles}
              onAddFuel={onAddFuel}
              onSaveToCanvas={handleSaveToCanvas}
            />
          ))}
        </>
      )}

      {data.relatedPosts.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <FileTextIcon size={14} color={theme.textSupporting} />
            <Text style={styles.sectionLabel}>{postsLabel}</Text>
          </View>
          {data.relatedPosts.map((p, i) => (
            <ContextCard
              key={i}
              item={p}
              type="post"
              mode={data.mode}
              styles={styles}
              onAddFuel={onAddFuel}
              onSaveToCanvas={handleSaveToCanvas}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}
