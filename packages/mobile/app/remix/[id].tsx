import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Image,
} from "react-native";
import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeftIcon, SparkleIcon, CopyIcon, ArrowClockwiseIcon, XIcon, PlusIcon,
} from "phosphor-react-native";
import ContextTab from "../../components/ContextTab";
import PlatformPreview from "../../components/remix/PlatformPreview";
import VariationSelector from "../../components/remix/VariationSelector";
import MemeImageGrid from "../../components/remix/MemeImageGrid";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { colors as paletteColors } from "../../theme/colors";
import type { RemixVariation, MemePost, MemeSearchMeta, PlatformId } from "../../types/remix";

const OUTPUT_TYPES = [
  { label: "Tweet", value: "tweet" },
  { label: "Thread", value: "thread" },
  { label: "Reel Script", value: "reel_script" },
  { label: "Hook", value: "hook" },
  { label: "Carousel", value: "carousel" },
  { label: "Meme Idea", value: "meme" },
  { label: "Blog Intro", value: "blog_intro" },
];

const PLATFORMS = [
  { label: "X", value: "x" },
  { label: "Instagram", value: "instagram" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "YouTube", value: "youtube" },
  { label: "Reddit", value: "reddit" },
];

const STYLES = [
  { label: "Casual", value: "casual" },
  { label: "Educational", value: "educational" },
  { label: "Funny", value: "funny" },
  { label: "Motivational", value: "motivational" },
  { label: "Controversial", value: "controversial" },
];

const TAKE_MAX_CHARS = 240;

const VALID_PLATFORMS = new Set<string>(PLATFORMS.map((p) => p.value));
const VALID_OUTPUT_TYPES = new Set<string>(OUTPUT_TYPES.map((t) => t.value));

type SavedRemixRow = {
  id: string;
  inspirationIds?: string;
  outputType: string;
  outputContent: string;
  platform?: string | null;
  variations?: string;
  selectedVariationIndex?: number;
  imageUrl?: string | null;
};

function hydrateFromSavedRemix(remix: SavedRemixRow) {
  let parsedVariations: RemixVariation[] = [];
  try {
    parsedVariations = JSON.parse(remix.variations || "[]");
  } catch {
    parsedVariations = [];
  }

  const outputType = remix.outputType.startsWith("merged_")
    ? remix.outputType.slice("merged_".length)
    : remix.outputType;

  const platform =
    remix.platform && remix.platform !== "multi" && VALID_PLATFORMS.has(remix.platform)
      ? remix.platform
      : "x";

  const idx =
    typeof remix.selectedVariationIndex === "number" ? remix.selectedVariationIndex : 0;

  return {
    remixId: remix.id,
    variations: parsedVariations,
    selectedVariationIndex: idx,
    outputType: VALID_OUTPUT_TYPES.has(outputType) ? outputType : "tweet",
    platform,
    savedRemixImage: remix.imageUrl ?? null,
  };
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBG },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { ...typography.heading, color: theme.text },

    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginHorizontal: 16,
      marginBottom: 4,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginRight: 20,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: theme.success },
    tabText: { color: theme.placeholderText, fontSize: 14, fontWeight: "600" },
    tabTextActive: { color: theme.success },
    fuelBadge: {
      backgroundColor: theme.success,
      borderRadius: 10,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    fuelBadgeText: { color: theme.appBG, fontSize: 10, fontWeight: "700" },

    content: { padding: 16, gap: 16 },
    sourceCard: {
      backgroundColor: theme.cardBG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      gap: 0,
    },
    sourceCardBody: { padding: 14, gap: 8 },
    sourceThumbnail: {
      width: "100%" as const,
      height: 160,
      backgroundColor: theme.highlightBG,
    },
    sourceLabel: { color: theme.placeholderText, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    sourceTitle: { color: theme.text, fontSize: 15, fontWeight: "600", lineHeight: 21 },
    styleBadge: { backgroundColor: theme.highlightBG, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
    styleBadgeText: { color: theme.textSupporting, fontSize: 11 },

    researchCard: {
      backgroundColor: theme.cardBG,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    researchTitle: { color: theme.text, fontWeight: "700", fontSize: 15 },
    researchHint: { color: theme.placeholderText, fontSize: 12, lineHeight: 17 },
    researchBtn: {
      backgroundColor: theme.success,
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: "center",
    },
    researchBtnDisabled: { opacity: 0.5 },
    researchBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 14 },
    researchError: { color: theme.danger, fontSize: 12 },

    fuelBar: {
      backgroundColor: theme.highlightBG,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.success + "33",
      padding: 12,
      gap: 8,
    },
    fuelBarHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
    fuelBarLabel: { color: paletteColors.green600, fontSize: 12, fontWeight: "700", flex: 1 },
    clearAllBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearAllBtnText: { color: theme.textSupporting, fontSize: 11, fontWeight: "600" },
    fuelHelpText: { color: theme.placeholderText, fontSize: 11, marginTop: -2 },
    fuelChips: { gap: 8 },
    fuelChip: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.cardBG,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fuelChipIndex: {
      color: paletteColors.green600,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },
    fuelChipText: { color: theme.textSupporting, fontSize: 12, flex: 1, lineHeight: 17 },

    takeCard: {
      backgroundColor: theme.cardBG,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    takeCollapsed: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
    },
    takeCollapsedText: { flex: 1, gap: 2 },
    takeCollapsedTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    takeCollapsedHint: { color: theme.placeholderText, fontSize: 11 },
    takePreview: { color: theme.textSupporting, fontSize: 13, flex: 1 },
    takeExpanded: { padding: 14, gap: 8 },
    takeExpandedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    takeExpandedLabel: { color: theme.textSupporting, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    takeInput: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 88,
      maxHeight: 120,
      padding: 0,
    },
    takeCounter: { color: theme.placeholderText, fontSize: 11, textAlign: "right" },

    error: { color: theme.danger, fontSize: 13, backgroundColor: "#EF444420", padding: 10, borderRadius: 8 },
    sectionLabel: { color: theme.textSupporting, fontSize: 13, fontWeight: "600" },
    chipRow: { gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.cardBG },
    chipActive: { backgroundColor: theme.success, borderColor: theme.success },
    chipText: { color: theme.textSupporting, fontSize: 13, fontWeight: "500" },
    chipTextActive: { color: theme.appBG, fontWeight: "700" },
    generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.success, padding: 16, borderRadius: 14 },
    generateBtnLoading: { opacity: 0.7 },
    generateBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 16 },
    results: { gap: 12 },
    resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    resultsTitle: { ...typography.heading, color: theme.text },
    regenBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
    regenBtnText: { color: theme.success, fontSize: 14, fontWeight: "600" },
    variationCard: { backgroundColor: theme.cardBG, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 10 },
    variationHeader: { gap: 2 },
    variationLabel: { color: theme.text, fontSize: 14, fontWeight: "700" },
    variationSubLabel: { color: theme.textSupporting, fontSize: 12 },
    variationContent: { color: theme.text, fontSize: 15, lineHeight: 22 },
    whyBox: { backgroundColor: theme.highlightBG, borderRadius: 10, padding: 10, gap: 2 },
    whyLabel: { color: theme.placeholderText, fontSize: 11, fontWeight: "600" },
    whyText: { color: theme.textSupporting, fontSize: 13 },
    copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: theme.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, alignSelf: "flex-start" },
    copyBtnText: { color: theme.success, fontSize: 13, fontWeight: "600" },
    previewSection: { gap: 12 },
  });
}

export default function RemixStudioScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const qc = useQueryClient();
  const { id, remixId: remixIdParam } = useLocalSearchParams<{
    id: string;
    remixId?: string | string[];
  }>();
  const remixIdFromRoute = Array.isArray(remixIdParam) ? remixIdParam[0] : remixIdParam;
  const [activeTab, setActiveTab] = useState<"studio" | "context">("studio");
  const [outputType, setOutputType] = useState("tweet");
  const [platform, setPlatform] = useState("x");
  const [style, setStyle] = useState("casual");
  const [variations, setVariations] = useState<RemixVariation[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);
  const [remixId, setRemixId] = useState<string | null>(null);
  const [savedRemixImage, setSavedRemixImage] = useState<string | null>(null);
  const [remixLoadError, setRemixLoadError] = useState("");
  const hydratedRemixIdRef = useRef<string | null>(null);
  const [memePosts, setMemePosts] = useState<MemePost[]>([]);
  const [memeSearchStatus, setMemeSearchStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [memeSearchError, setMemeSearchError] = useState("");
  const [memeRemaining, setMemeRemaining] = useState<number | undefined>();
  const [memeMeta, setMemeMeta] = useState<MemeSearchMeta | undefined>();
  const patchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState("");
  const [fuelItems, setFuelItems] = useState<string[]>([]);
  const [userTake, setUserTake] = useState("");
  const [takeExpanded, setTakeExpanded] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");

  const { data: inspiration, isLoading: inspirationLoading } = useQuery({
    queryKey: ["inspiration", id],
    queryFn: async () => {
      const res = await api.inspirations[":id"].$get({ param: { id: id! } });
      const d = await res.json();
      return "inspiration" in d ? d.inspiration : null;
    },
    enabled: !!id,
    staleTime: 0,
  });

  const { data: savedRemix, isError: savedRemixError } = useQuery({
    queryKey: ["remix", remixIdFromRoute],
    queryFn: async () => {
      const res = await api.remixes[":id"].$get({ param: { id: remixIdFromRoute! } });
      const d = await res.json();
      if (!res.ok) {
        throw new Error((d as { message?: string }).message ?? "Remix not found");
      }
      return "remix" in d ? (d.remix as SavedRemixRow) : null;
    },
    enabled: !!remixIdFromRoute,
    initialData: () => {
      const list = qc.getQueryData<SavedRemixRow[]>(["remixes"]);
      return list?.find((r) => r.id === remixIdFromRoute);
    },
    initialDataUpdatedAt: () => qc.getQueryState(["remixes"])?.dataUpdatedAt,
  });

  useEffect(() => {
    hydratedRemixIdRef.current = null;
    setSavedRemixImage(null);
  }, [remixIdFromRoute]);

  useEffect(() => {
    if (!savedRemix || hydratedRemixIdRef.current === savedRemix.id) return;
    const hydrated = hydrateFromSavedRemix(savedRemix);
    hydratedRemixIdRef.current = savedRemix.id;
    setRemixId(hydrated.remixId);
    setVariations(hydrated.variations);
    setSelectedVariationIndex(hydrated.selectedVariationIndex);
    setOutputType(hydrated.outputType);
    setPlatform(hydrated.platform);
    setSavedRemixImage(hydrated.savedRemixImage);
    setRemixLoadError("");
  }, [savedRemix]);

  useEffect(() => {
    if (savedRemixError && remixIdFromRoute) {
      setRemixLoadError("Could not load saved remix.");
    }
  }, [savedRemixError, remixIdFromRoute]);

  useEffect(() => {
    if (remixIdFromRoute && inspiration?.writingStyle) {
      setStyle(inspiration.writingStyle);
    }
  }, [remixIdFromRoute, inspiration?.writingStyle]);

  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await api.users.profile.$get();
      const d = await res.json();
      return "profile" in d ? d : null;
    },
  });

  const isPremium =
    (profileData as { isPremium?: boolean } | null)?.isPremium ??
    profileData?.profile?.plan === "premium";
  const grokConnected =
    (profileData as { grokConnected?: boolean } | null)?.grokConnected ?? false;
  const isXInspiration =
    inspiration?.sourcePlatform === "twitter" ||
    inspiration?.sourcePlatform === "x" ||
    (inspiration?.sourceUrl ?? "").includes("x.com") ||
    (inspiration?.sourceUrl ?? "").includes("twitter.com");

  const trimmedTake = userTake.trim();

  async function researchOnX() {
    if (!id || !isPremium) {
      setResearchError("Premium required for Research on X");
      return;
    }
    setResearchLoading(true);
    setResearchError("");
    try {
      const res = await api.x.research.$post({ json: { inspirationId: id } });
      const d = await res.json();
      if (!res.ok) {
        throw new Error((d as any).message ?? "Research failed");
      }
      const posts = (d as any).relatedPosts ?? [];
      const comments = (d as any).comments ?? [];
      const items: string[] = [];
      for (const p of posts) {
        if (p.title) items.push(`${p.title}${p.url ? `\n${p.url}` : ""}`);
      }
      for (const c of comments) {
        if (c.body) items.push(c.body);
      }
      if (items.length === 0) {
        setResearchError("No X posts found. Try Apify source in Settings.");
        return;
      }
      items.slice(0, 6).forEach((text) => addFuel(text));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setResearchError(err.message ?? "Research failed");
    } finally {
      setResearchLoading(false);
    }
  }

  const fetchMemes = useCallback(async () => {
    if (!id || !grokConnected) return;
    setMemeSearchStatus("loading");
    setMemeSearchError("");
    try {
      const res = await api.x["meme-search"].$post({ json: { inspirationId: id } });
      const d = await res.json();
      if (!res.ok) {
        if ((d as { grokRequired?: boolean }).grokRequired) {
          setMemeSearchStatus("idle");
          return;
        }
        throw new Error((d as { message?: string }).message ?? "Meme search failed");
      }
      const payload = d as {
        memes?: MemePost[];
        remainingToday?: number;
        meta?: MemeSearchMeta;
      };
      setMemePosts(payload.memes ?? []);
      setMemeRemaining(payload.remainingToday);
      setMemeMeta(payload.meta);
      setMemeSearchStatus("done");
    } catch (err: unknown) {
      setMemeSearchError(err instanceof Error ? err.message : "Meme search failed");
      setMemeSearchStatus("error");
    }
  }, [id, grokConnected]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const fuelContext = fuelItems.length > 0 ? fuelItems.join("\n\n") : undefined;
      const res = await api.remixes.generate.$post({
        json: {
          inspirationId: id,
          outputType,
          targetPlatform: platform,
          style,
          fuelContext,
          userTake: trimmedTake || undefined,
        } as any,
      });
      const d = await res.json();
      if (res.status === 403) {
        throw new Error((d as any).message ?? "Limit reached");
      }
      return d;
    },
    onSuccess: (data: any) => {
      setVariations(data.variations ?? []);
      setSelectedVariationIndex(0);
      setRemixId(data.remix?.id ?? null);
      hydratedRemixIdRef.current = data.remix?.id ?? null;
      setSavedRemixImage(null);
      setMemePosts([]);
      setMemeMeta(undefined);
      setMemeSearchStatus("idle");
      setError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (outputType === "meme" && grokConnected) {
        fetchMemes();
      }
    },
    onError: (err: any) => {
      setError(err.message ?? "Generation failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const patchVariationMutation = useMutation({
    mutationFn: async ({ remixId: rid, index }: { remixId: string; index: number }) => {
      const res = await api.remixes[":id"].$patch({
        param: { id: rid },
        json: { selectedVariationIndex: index },
      } as { param: { id: string }; json: { selectedVariationIndex: number } });
      if (!res.ok) {
        const d = await res.json();
        throw new Error((d as { message?: string }).message ?? "Could not save selection");
      }
    },
  });

  function schedulePatchSelection(index: number) {
    if (!remixId) return;
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = setTimeout(() => {
      patchVariationMutation.mutate({ remixId, index });
    }, 400);
  }

  function handleSelectVariation(index: number) {
    setSelectedVariationIndex(index);
    schedulePatchSelection(index);
  }

  async function copySelected() {
    const content = variations[selectedVariationIndex]?.content;
    if (!content) return;
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current);
    };
  }, []);

  const selectedContent = variations[selectedVariationIndex]?.content ?? "";
  const previewImage = savedRemixImage ?? inspiration?.ogImage ?? null;

  function addFuel(text: string) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    setFuelItems((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
    setActiveTab("studio");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function removeFuel(index: number) {
    setFuelItems((prev) => prev.filter((_, i) => i !== index));
    Haptics.selectionAsync();
  }

  function handleSaveToCanvas() {
    // Canvas is updated via query invalidation inside ContextTab
  }

  function getGenerateLabel() {
    if (trimmedTake) return "Generate with My Take";
    if (fuelItems.length > 0) return "Generate with Context";
    return "Generate Content";
  }

  function clearTake() {
    setUserTake("");
    setTakeExpanded(false);
    Haptics.selectionAsync();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Remix Studio</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "studio" && styles.tabActive]}
          onPress={() => setActiveTab("studio")}
        >
          <SparkleIcon
            size={14}
            color={activeTab === "studio" ? theme.success : theme.placeholderText}
            weight={activeTab === "studio" ? "fill" : "regular"}
          />
          <Text style={[styles.tabText, activeTab === "studio" && styles.tabTextActive]}>
            Studio
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "context" && styles.tabActive]}
          onPress={() => setActiveTab("context")}
        >
          <Text style={[styles.tabText, activeTab === "context" && styles.tabTextActive]}>
            Context
          </Text>
          {fuelItems.length > 0 && (
            <View style={styles.fuelBadge}>
              <Text style={styles.fuelBadgeText}>{fuelItems.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === "context" ? (
        <ContextTab
          inspirationId={id!}
          onAddFuel={addFuel}
          onSaveToCanvas={handleSaveToCanvas}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {remixLoadError ? (
            <Text style={{ color: theme.placeholderText, fontSize: 13 }}>{remixLoadError}</Text>
          ) : null}
          {/* Original content */}
          {inspirationLoading ? (
            <ActivityIndicator color={theme.success} />
          ) : inspiration ? (
            <View style={styles.sourceCard}>
              {inspiration.ogImage ? (
                <Image
                  source={{ uri: inspiration.ogImage }}
                  style={styles.sourceThumbnail}
                  resizeMode="cover"
                  accessibilityLabel="Original post preview"
                />
              ) : null}
              <View style={styles.sourceCardBody}>
                <Text style={styles.sourceLabel}>Original · {inspiration.sourcePlatform}</Text>
                <Text style={styles.sourceTitle} numberOfLines={3}>
                  {inspiration.title || inspiration.rawContent}
                </Text>
                {inspiration.writingStyle && (
                  <View style={styles.styleBadge}>
                    <Text style={styles.styleBadgeText}>Style: {inspiration.writingStyle}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {isXInspiration && (
            <View style={styles.researchCard}>
              <Text style={styles.researchTitle}>Research on X</Text>
              <Text style={styles.researchHint}>
                Pull live posts from X into remix fuel (Grok or Apify per Settings).
              </Text>
              <TouchableOpacity
                style={[styles.researchBtn, !isPremium && styles.researchBtnDisabled]}
                onPress={researchOnX}
                disabled={researchLoading || !isPremium}
              >
                {researchLoading ? (
                  <ActivityIndicator color={theme.appBG} size="small" />
                ) : (
                  <Text style={styles.researchBtnText}>
                    {isPremium ? "Scan X for angles" : "Premium required"}
                  </Text>
                )}
              </TouchableOpacity>
              {researchError ? (
                <Text style={styles.researchError}>{researchError}</Text>
              ) : null}
            </View>
          )}

          {/* Fuel Bar */}
          {fuelItems.length > 0 && (
            <View style={styles.fuelBar}>
              <View style={styles.fuelBarHeader}>
                <SparkleIcon size={12} color={theme.success} weight="fill" />
                <Text style={styles.fuelBarLabel}>
                  {fuelItems.length} fuel item{fuelItems.length > 1 ? "s" : ""} added
                </Text>
                <TouchableOpacity onPress={() => setFuelItems([])} style={styles.clearAllBtn}>
                  <Text style={styles.clearAllBtnText}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fuelHelpText}>These signals will shape the generation output.</Text>
              <View style={styles.fuelChips}>
                {fuelItems.map((item, i) => (
                  <View key={i} style={styles.fuelChip}>
                    <Text style={styles.fuelChipIndex}>#{i + 1}</Text>
                    <Text style={styles.fuelChipText} numberOfLines={2}>
                      {item}
                    </Text>
                    <TouchableOpacity onPress={() => removeFuel(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <XIcon size={11} color={theme.placeholderText} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Your Take */}
          <View style={styles.takeCard}>
            {!takeExpanded ? (
              <TouchableOpacity
                style={styles.takeCollapsed}
                onPress={() => setTakeExpanded(true)}
                activeOpacity={0.8}
              >
                <PlusIcon size={14} color={theme.success} />
                {trimmedTake ? (
                  <Text style={styles.takePreview} numberOfLines={1}>
                    {trimmedTake.slice(0, 60)}{trimmedTake.length > 60 ? "…" : ""}
                  </Text>
                ) : (
                  <View style={styles.takeCollapsedText}>
                    <Text style={styles.takeCollapsedTitle}>Add your take (optional)</Text>
                    <Text style={styles.takeCollapsedHint}>Sharper output when you share your angle</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.takeExpanded}>
                <View style={styles.takeExpandedHeader}>
                  <Text style={styles.takeExpandedLabel}>Your take</Text>
                  <TouchableOpacity onPress={clearTake} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <XIcon size={16} color={theme.placeholderText} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.takeInput}
                  value={userTake}
                  onChangeText={(t) => setUserTake(t.slice(0, TAKE_MAX_CHARS))}
                  placeholder="What's your angle on this? e.g. I disagree because..."
                  placeholderTextColor={theme.placeholderText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoFocus
                />
                <Text style={styles.takeCounter}>
                  {userTake.length}/{TAKE_MAX_CHARS}
                </Text>
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Output format */}
          <Text style={styles.sectionLabel}>Output format</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {OUTPUT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, outputType === t.value && styles.chipActive]}
                onPress={() => { setOutputType(t.value); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.chipText, outputType === t.value && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Target platform */}
          <Text style={styles.sectionLabel}>Target platform</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PLATFORMS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.chip, platform === p.value && styles.chipActive]}
                onPress={() => { setPlatform(p.value); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.chipText, platform === p.value && styles.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Writing style */}
          <Text style={styles.sectionLabel}>Writing style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STYLES.map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.chip, style === s.value && styles.chipActive]}
                onPress={() => { setStyle(s.value); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.chipText, style === s.value && styles.chipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Generate button */}
          <TouchableOpacity
            style={[styles.generateBtn, generateMutation.isPending && styles.generateBtnLoading]}
            onPress={() => { generateMutation.mutate(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <>
                <ActivityIndicator color={theme.appBG} />
                <Text style={styles.generateBtnText}>Generating...</Text>
              </>
            ) : (
              <>
                <SparkleIcon size={18} color={theme.appBG} weight="fill" />
                <Text style={styles.generateBtnText}>{getGenerateLabel()}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Results */}
          {variations.length > 0 && (
            <View style={styles.results}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Results</Text>
                <TouchableOpacity
                  style={styles.regenBtn}
                  onPress={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  <ArrowClockwiseIcon size={16} color={theme.success} />
                  <Text style={styles.regenBtnText}>Regenerate</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewSection}>
                <PlatformPreview
                  platform={platform as PlatformId}
                  content={selectedContent}
                  imageUrl={previewImage}
                />
                <VariationSelector
                  variations={variations}
                  selectedIndex={selectedVariationIndex}
                  onSelect={handleSelectVariation}
                />
                <TouchableOpacity style={styles.copyBtn} onPress={copySelected}>
                  <CopyIcon size={14} color={theme.success} />
                  <Text style={styles.copyBtnText}>Copy selected</Text>
                </TouchableOpacity>
                {variations[selectedVariationIndex]?.why_it_works && (
                  <View style={styles.whyBox}>
                    <Text style={styles.whyLabel}>Why it works</Text>
                    <Text style={styles.whyText}>
                      {variations[selectedVariationIndex].why_it_works}
                    </Text>
                  </View>
                )}
              </View>

              {outputType === "meme" && (
                <MemeImageGrid
                  memes={memePosts}
                  status={memeSearchStatus}
                  errorMessage={memeSearchError}
                  grokConnected={grokConnected}
                  remainingToday={memeRemaining}
                  meta={memeMeta}
                  onRefresh={fetchMemes}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
