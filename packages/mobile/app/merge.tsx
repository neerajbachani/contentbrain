import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from "react-native";
import { useState, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  ArrowLeftIcon, SparkleIcon, CopyIcon, CheckIcon,
  XIcon, FloppyDiskIcon,
} from "phosphor-react-native";
import { typography } from "../constants/typography";
import { api } from "../lib/api";
import { useTheme, useThemedStyles } from "../theme";
import type { ThemeColors } from "../theme/types";

const OUTPUT_TYPES = [
  { id: "tweet_thread", label: "Tweet Thread" },
  { id: "youtube_script", label: "YouTube Script" },
  { id: "reel_script", label: "Reel Script" },
  { id: "newsletter", label: "Newsletter" },
  { id: "carousel", label: "Carousel" },
  { id: "meme_series", label: "Meme Series" },
] as const;

type OutputType = (typeof OUTPUT_TYPES)[number]["id"];

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBG },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: { padding: 8 },
    headerTitle: { ...typography.heading3, color: theme.text },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },

    sectionLabel: {
      ...typography.caption,
      color: theme.textSupporting,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 20,
    },
    optional: { color: theme.placeholderText, textTransform: "none", letterSpacing: 0 },

    toggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    toggleChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.cardBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    toggleChipActive: { backgroundColor: theme.success, borderColor: theme.success },
    toggleChipText: { ...typography.caption, color: theme.textSupporting, fontSize: 13 },
    toggleChipTextActive: { color: "#fff", fontWeight: "600" },
    hintText: { ...typography.caption, color: theme.placeholderText, marginBottom: 4 },

    warning: {
      ...typography.body,
      color: theme.warning,
      marginBottom: 8,
    },

    chipRow: { flexDirection: "row", marginBottom: 4 },
    sourceChip: {
      backgroundColor: theme.cardBG,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 8,
      maxWidth: 140,
    },
    sourceChipPlatform: {
      ...typography.caption,
      color: theme.placeholderText,
      fontSize: 10,
      marginBottom: 2,
    },
    sourceChipTitle: { ...typography.caption, color: theme.text, fontSize: 12 },

    emptyText: { ...typography.body, color: theme.placeholderText, fontStyle: "italic" },

    outputGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 4,
    },
    outputChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.cardBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    outputChipActive: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    outputChipText: { ...typography.caption, color: theme.textSupporting, fontSize: 13 },
    outputChipTextActive: { color: "#fff", fontWeight: "600" },

    contextInput: {
      backgroundColor: theme.cardBG,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      padding: 12,
      minHeight: 80,
      textAlignVertical: "top",
      ...typography.body,
      fontSize: 14,
      marginBottom: 4,
    },

    generateBtn: {
      backgroundColor: theme.success,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      shadowColor: theme.success,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    generateBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
    generateBtnText: { color: "#fff", ...typography.heading3, fontSize: 16 },

    resultCard: {
      backgroundColor: theme.cardBG,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginTop: 24,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    resultLabel: { ...typography.heading3, color: theme.text, fontSize: 15 },
    resultActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    savedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    savedText: { ...typography.caption, color: theme.success, fontSize: 11 },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.appBG,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    copyBtnText: { ...typography.caption, color: theme.success, fontSize: 12 },
    resultImage: {
      width: "100%",
      height: 200,
      borderRadius: 10,
      marginBottom: 12,
      backgroundColor: theme.appBG,
    },
    imageErrorText: {
      ...typography.caption,
      color: theme.warning,
      marginBottom: 8,
    },
    regenerateBtn: {
      alignSelf: "flex-start",
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.appBG,
    },
    regenerateBtnText: { ...typography.caption, color: theme.success, fontSize: 12 },
    resultText: { ...typography.body, color: theme.text, lineHeight: 22 },
  });
}

export default function MergeScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const inspirationIds = ids ? ids.split(",").filter(Boolean) : [];

  const [outputType, setOutputType] = useState<OutputType>("tweet_thread");
  const [context, setContext] = useState("");
  const [generateImage, setGenerateImage] = useState(false);
  const [useReferences, setUseReferences] = useState(true);
  const [imagePrompt, setImagePrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lastRemixId, setLastRemixId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: inspirations } = useQuery({
    queryKey: ["inspirations"],
    queryFn: async () => {
      const res = await api.inspirations.$get();
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as any;
      return (data?.inspirations ?? []) as any[];
    },
    staleTime: 60_000,
  });

  const selectedInspirations = (inspirations ?? []).filter((i: any) =>
    inspirationIds.includes(i.id)
  );

  const refsAvailable = selectedInspirations.filter((i: any) => i.ogImage?.trim()).length;

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.merge.generate.$post({
        json: {
          inspirationIds,
          outputType,
          context: context.trim() || undefined,
          generateImage,
          useReferences: generateImage ? useReferences : undefined,
          imagePrompt: generateImage && imagePrompt.trim() ? imagePrompt.trim() : undefined,
          referenceMode: "auto",
        },
      });
      if (res.status === 403) {
        const data = await res.json() as any;
        throw Object.assign(new Error(data.message), { limitReached: true });
      }
      if (!res.ok) throw new Error("Merge failed");
      return res.json() as Promise<{
        content: string;
        remix: any;
        image?: string | null;
        imageError?: string;
      }>;
    },
    onSuccess: (data) => {
      setResult(data.content);
      setResultImage(data.image ?? data.remix?.imageUrl ?? null);
      setImageError(data.imageError ?? null);
      setLastRemixId(data.remix?.id ?? null);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["remixes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err.limitReached) {
        Alert.alert(
          "Daily Limit Reached",
          "Upgrade to Premium for unlimited merges.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Upgrade", onPress: () => router.push("/(tabs)/settings") },
          ]
        );
      } else {
        Alert.alert("Error", err.message || "Something went wrong");
      }
    },
  });

  async function handleCopy() {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }

  const regenerateImageMutation = useMutation({
    mutationFn: async () => {
      if (!lastRemixId) throw new Error("No merge to regenerate");
      const res = await api.merge["regenerate-image"].$post({
        json: {
          remixId: lastRemixId,
          useReferences,
          imagePrompt: imagePrompt.trim() || undefined,
          referenceMode: "auto",
        },
      });
      if (!res.ok) throw new Error("Image regeneration failed");
      return res.json() as Promise<{ image?: string | null; imageError?: string | null; remix?: any }>;
    },
    onSuccess: (data) => {
      setResultImage(data.image ?? data.remix?.imageUrl ?? null);
      setImageError(data.imageError ?? null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      Alert.alert("Image error", err.message || "Could not regenerate image");
    },
  });

  function handleGenerate() {
    if (inspirationIds.length < 2) {
      Alert.alert("Need at least 2 inspirations", "Go back and select more.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResult(null);
    setResultImage(null);
    setImageError(null);
    setSaved(false);
    mergeMutation.mutate();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeftIcon size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Merge Studio</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Source chips */}
        <Text style={styles.sectionLabel}>Sources ({inspirationIds.length})</Text>
        {inspirationIds.length < 2 && (
          <Text style={styles.warning}>Select at least 2 inspirations from Library.</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {selectedInspirations.length > 0 ? (
            selectedInspirations.map((item: any) => (
              <View key={item.id} style={styles.sourceChip}>
                <Text style={styles.sourceChipPlatform}>{item.sourcePlatform}</Text>
                <Text style={styles.sourceChipTitle} numberOfLines={1}>
                  {(item.title || item.rawContent || "").slice(0, 32)}
                </Text>
              </View>
            ))
          ) : inspirationIds.length > 0 ? (
            inspirationIds.map((id) => (
              <View key={id} style={styles.sourceChip}>
                <Text style={styles.sourceChipTitle} numberOfLines={1}>{id.slice(0, 8)}…</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No sources selected</Text>
          )}
        </ScrollView>

        {/* Output type */}
        <Text style={styles.sectionLabel}>Output type</Text>
        <View style={styles.outputGrid}>
          {OUTPUT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.outputChip, outputType === t.id && styles.outputChipActive]}
              onPress={() => { setOutputType(t.id); Haptics.selectionAsync(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.outputChipText, outputType === t.id && styles.outputChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image generation toggle */}
        <Text style={styles.sectionLabel}>Image</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleChip, generateImage && styles.toggleChipActive]}
            onPress={() => setGenerateImage((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleChipText, generateImage && styles.toggleChipTextActive]}>
              {generateImage ? "Generate image ON" : "Generate image OFF"}
            </Text>
          </TouchableOpacity>
        </View>
        {generateImage && (
          <>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleChip, useReferences && styles.toggleChipActive]}
                onPress={() => setUseReferences((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleChipText, useReferences && styles.toggleChipTextActive]}>
                  {useReferences ? "Use post images as refs" : "No reference images"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              {refsAvailable > 0
                ? `${refsAvailable} of ${selectedInspirations.length} sources have preview images.`
                : "No preview images on selected sources — generation will be prompt-only."}
            </Text>
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
              Image prompt <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.contextInput}
              placeholder="e.g. cinematic tech blog hero, dark mode, minimal"
              placeholderTextColor={theme.placeholderText}
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={2}
              maxLength={500}
            />
          </>
        )}

        {/* Context input */}
        <Text style={styles.sectionLabel}>Context <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.contextInput}
          placeholder="e.g. Make it funny and suitable for Gen Z audience"
          placeholderTextColor={theme.placeholderText}
          value={context}
          onChangeText={setContext}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        {/* Generate CTA */}
        <TouchableOpacity
          style={[styles.generateBtn, (mergeMutation.isPending || inspirationIds.length < 2) && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={mergeMutation.isPending || inspirationIds.length < 2}
          activeOpacity={0.8}
        >
          {mergeMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <SparkleIcon size={18} color="#fff" weight="fill" />
              <Text style={styles.generateBtnText}>Generate Merge</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel}>Result</Text>
              <View style={styles.resultActions}>
                {saved && (
                  <View style={styles.savedBadge}>
                    <FloppyDiskIcon size={12} color={theme.success} />
                    <Text style={styles.savedText}>Saved</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
                  {copied ? (
                    <CheckIcon size={14} color={theme.success} weight="bold" />
                  ) : (
                    <CopyIcon size={14} color={theme.success} />
                  )}
                  <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy All"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {resultImage ? (
              <Image source={{ uri: resultImage }} style={styles.resultImage} resizeMode="cover" />
            ) : imageError ? (
              <Text style={styles.imageErrorText}>Image: {imageError}</Text>
            ) : null}
            {generateImage && lastRemixId && (
              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={() => regenerateImageMutation.mutate()}
                disabled={regenerateImageMutation.isPending}
                activeOpacity={0.7}
              >
                {regenerateImageMutation.isPending ? (
                  <ActivityIndicator color={theme.success} size="small" />
                ) : (
                  <Text style={styles.regenerateBtnText}>Regenerate image</Text>
                )}
              </TouchableOpacity>
            )}
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
