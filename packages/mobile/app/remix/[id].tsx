import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  ArrowLeftIcon, SparkleIcon, CopyIcon, ArrowClockwiseIcon,
} from "phosphor-react-native";

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

function VariationCard({ variation, index }: { variation: any; index: number }) {
  const labels = ["🔥 Variation 1", "⚡ Variation 2 — Different Angle", "✨ Variation 3 — Unique Twist"];

  async function copy() {
    await Clipboard.setStringAsync(variation.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.variationCard}>
      <View style={styles.variationHeader}>
        <Text style={styles.variationLabel}>{labels[index] ?? `Variation ${index + 1}`}</Text>
        {variation.label && <Text style={styles.variationSubLabel}>{variation.label}</Text>}
      </View>

      <Text style={styles.variationContent}>{variation.content}</Text>

      {variation.why_it_works && (
        <View style={styles.whyBox}>
          <Text style={styles.whyLabel}>Why it works</Text>
          <Text style={styles.whyText}>{variation.why_it_works}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.copyBtn} onPress={copy}>
        <CopyIcon size={14} color={colors.accent} />
        <Text style={styles.copyBtnText}>Copy</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RemixStudioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [outputType, setOutputType] = useState("tweet");
  const [platform, setPlatform] = useState("x");
  const [style, setStyle] = useState("casual");
  const [variations, setVariations] = useState<any[]>([]);
  const [error, setError] = useState("");

  const { data: inspiration, isLoading } = useQuery({
    queryKey: ["inspiration", id],
    queryFn: async () => {
      const res = await api.inspirations[":id"].$get({ param: { id: id! } });
      const d = await res.json();
      return "inspiration" in d ? d.inspiration : null;
    },
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.remixes.generate.$post({
        json: { inspirationId: id, outputType, targetPlatform: platform, style },
      });
      const d = await res.json();
      if (res.status === 403) {
        throw new Error((d as any).message ?? "Limit reached");
      }
      return d;
    },
    onSuccess: (data: any) => {
      setVariations(data.variations ?? []);
      setError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      setError(err.message ?? "Generation failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Remix Studio</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Original content */}
        {isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : inspiration ? (
          <View style={styles.sourceCard}>
            <Text style={styles.sourceLabel}>Original · {inspiration.sourcePlatform}</Text>
            <Text style={styles.sourceTitle} numberOfLines={3}>{inspiration.title || inspiration.rawContent}</Text>
            {inspiration.writingStyle && (
              <View style={styles.styleBadge}>
                <Text style={styles.styleBadgeText}>Style: {inspiration.writingStyle}</Text>
              </View>
            )}
          </View>
        ) : null}

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
              <ActivityIndicator color={colors.background} />
              <Text style={styles.generateBtnText}>Generating...</Text>
            </>
          ) : (
            <>
              <SparkleIcon size={18} color={colors.background} weight="fill" />
              <Text style={styles.generateBtnText}>Generate Content</Text>
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
                <ArrowClockwiseIcon size={16} color={colors.accent} />
                <Text style={styles.regenBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
            {variations.map((v, i) => <VariationCard key={i} variation={v} index={i} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { ...typography.heading, color: colors.textPrimary },
  content: { padding: 16, gap: 16 },
  sourceCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  sourceLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  sourceTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  styleBadge: { backgroundColor: colors.surfaceElevated, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  styleBadgeText: { color: colors.textSecondary, fontSize: 11 },
  error: { color: colors.danger, fontSize: 13, backgroundColor: "#EF444420", padding: 10, borderRadius: 8 },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipRow: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: colors.background, fontWeight: "700" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent, padding: 16, borderRadius: 14 },
  generateBtnLoading: { opacity: 0.7 },
  generateBtnText: { color: colors.background, fontWeight: "700", fontSize: 16 },
  results: { gap: 12 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultsTitle: { ...typography.heading, color: colors.textPrimary },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  regenBtnText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  variationCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  variationHeader: { gap: 2 },
  variationLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  variationSubLabel: { color: colors.textSecondary, fontSize: 12 },
  variationContent: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  whyBox: { backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 2 },
  whyLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: "600" },
  whyText: { color: colors.textSecondary, fontSize: 13 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: "flex-start" },
  copyBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
});
