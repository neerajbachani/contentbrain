import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { MemePost, MemeSearchMeta } from "../../types/remix";
import ImageLightbox from "../shared/ImageLightbox";
import { ArrowClockwiseIcon } from "phosphor-react-native";

type Props = {
  memes: MemePost[];
  status: "idle" | "loading" | "error" | "done";
  errorMessage?: string;
  grokConnected: boolean;
  remainingToday?: number;
  meta?: MemeSearchMeta;
  onRefresh: () => void;
};

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 10 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: theme.text, fontSize: 15, fontWeight: "700" },
    sub: { color: theme.placeholderText, fontSize: 11 },
    refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    refreshText: { color: theme.success, fontSize: 13, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: {
      width: "48%",
      aspectRatio: 1,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    thumb: { width: "100%", height: "100%" },
    empty: {
      backgroundColor: theme.cardBG,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 8,
      alignItems: "center",
    },
    emptyText: { color: theme.textSupporting, fontSize: 13, textAlign: "center", lineHeight: 18 },
    ctaBtn: {
      marginTop: 8,
      backgroundColor: theme.success,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    ctaText: { color: theme.appBG, fontWeight: "700", fontSize: 14 },
    error: { color: theme.danger, fontSize: 12 },
  });
}

export default function MemeImageGrid({
  memes,
  status,
  errorMessage,
  grokConnected,
  remainingToday,
  meta,
  onRefresh,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [lightbox, setLightbox] = useState<MemePost | null>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meme references</Text>
          {remainingToday != null && (
            <Text style={styles.sub}>{remainingToday} X searches left today</Text>
          )}
        </View>
        {grokConnected && (
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} disabled={status === "loading"}>
            <ArrowClockwiseIcon size={16} color={theme.success} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {status === "loading" && (
        <ActivityIndicator style={{ paddingVertical: 24 }} />
      )}

      {!grokConnected && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Connect Grok (Hermes) in Settings to find meme images on X for this topic.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/(tabs)/settings")}>
            <Text style={styles.ctaText}>Connect Grok</Text>
          </TouchableOpacity>
        </View>
      )}

      {grokConnected && status === "error" && (
        <View style={styles.empty}>
          <Text style={styles.error}>{errorMessage ?? "Could not load memes"}</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={onRefresh}>
            <Text style={styles.ctaText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {grokConnected && status === "done" && memes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {(meta?.rawPosts ?? 0) > 0
              ? `Found ${meta!.rawPosts} X posts but couldn't load images. Tap Refresh.`
              : "No meme images found for this topic. Try Refresh."}
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={onRefresh}>
            <Text style={styles.ctaText}>Refresh memes</Text>
          </TouchableOpacity>
        </View>
      )}

      {memes.length > 0 && (
        <ScrollView horizontal={false} nestedScrollEnabled>
          <View style={styles.grid}>
            {memes.map((m, i) => (
              <TouchableOpacity
                key={`${m.url}-${i}`}
                style={styles.cell}
                onPress={() => setLightbox(m)}
                activeOpacity={0.9}
              >
                {m.thumbnailUrl ? (
                  <Image source={{ uri: m.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {lightbox?.thumbnailUrl && (
        <ImageLightbox
          visible={!!lightbox}
          imageUrl={lightbox.thumbnailUrl}
          postUrl={lightbox.url}
          title={lightbox.title?.slice(0, 80)}
          onClose={() => setLightbox(null)}
        />
      )}
    </View>
  );
}
