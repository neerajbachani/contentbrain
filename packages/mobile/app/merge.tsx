import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Pressable,
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
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { api } from "../lib/api";

const OUTPUT_TYPES = [
  { id: "tweet_thread", label: "Tweet Thread" },
  { id: "youtube_script", label: "YouTube Script" },
  { id: "reel_script", label: "Reel Script" },
  { id: "newsletter", label: "Newsletter" },
  { id: "carousel", label: "Carousel" },
  { id: "meme_series", label: "Meme Series" },
] as const;

type OutputType = (typeof OUTPUT_TYPES)[number]["id"];

export default function MergeScreen() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const inspirationIds = ids ? ids.split(",").filter(Boolean) : [];

  const [outputType, setOutputType] = useState<OutputType>("tweet_thread");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Grab inspirations from cache
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

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.merge.generate.$post({
        json: { inspirationIds, outputType, context: context.trim() || undefined },
      });
      if (res.status === 403) {
        const data = await res.json() as any;
        throw Object.assign(new Error(data.message), { limitReached: true });
      }
      if (!res.ok) throw new Error("Merge failed");
      return res.json() as Promise<{ content: string; remix: any }>;
    },
    onSuccess: (data) => {
      setResult(data.content);
      setSaved(true); // auto-saved by API
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

  function handleGenerate() {
    if (inspirationIds.length < 2) {
      Alert.alert("Need at least 2 inspirations", "Go back and select more.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResult(null);
    setSaved(false);
    mergeMutation.mutate();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeftIcon size={20} color={colors.textPrimary} />
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

        {/* Output type picker */}
        <Text style={styles.sectionLabel}>Output Type</Text>
        <View style={styles.outputGrid}>
          {OUTPUT_TYPES.map((ot) => (
            <TouchableOpacity
              key={ot.id}
              style={[styles.outputChip, outputType === ot.id && styles.outputChipActive]}
              onPress={() => setOutputType(ot.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.outputChipText, outputType === ot.id && styles.outputChipTextActive]}>
                {ot.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Context input */}
        <Text style={styles.sectionLabel}>Context <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.contextInput}
          placeholder="e.g. Make it funny and suitable for Gen Z audience"
          placeholderTextColor={colors.textTertiary}
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
                    <FloppyDiskIcon size={12} color={colors.accent} />
                    <Text style={styles.savedText}>Saved</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
                  {copied ? (
                    <CheckIcon size={14} color={colors.accent} weight="bold" />
                  ) : (
                    <CopyIcon size={14} color={colors.accent} />
                  )}
                  <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy All"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  headerTitle: { ...typography.heading3, color: colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },
  optional: { color: colors.textTertiary, textTransform: "none", letterSpacing: 0 },

  warning: {
    ...typography.body,
    color: colors.warning ?? "#F59E0B",
    marginBottom: 8,
  },

  chipRow: { flexDirection: "row", marginBottom: 4 },
  sourceChip: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 140,
  },
  sourceChipPlatform: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
    marginBottom: 2,
  },
  sourceChipTitle: { ...typography.caption, color: colors.textPrimary, fontSize: 12 },

  emptyText: { ...typography.body, color: colors.textTertiary, fontStyle: "italic" },

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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outputChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  outputChipText: { ...typography.caption, color: colors.textSecondary, fontSize: 13 },
  outputChipTextActive: { color: "#fff", fontWeight: "600" },

  contextInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    ...typography.body,
    fontSize: 14,
    marginBottom: 4,
  },

  generateBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  generateBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  generateBtnText: { color: "#fff", ...typography.heading3, fontSize: 16 },

  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 24,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultLabel: { ...typography.heading3, color: colors.textPrimary, fontSize: 15 },
  resultActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  savedText: { ...typography.caption, color: colors.accent, fontSize: 11 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnText: { ...typography.caption, color: colors.accent, fontSize: 12 },
  resultText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
});
