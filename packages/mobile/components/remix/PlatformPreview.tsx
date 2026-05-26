import { View, Text, StyleSheet, Image } from "react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { PlatformId } from "../../types/remix";
import {
  ChatCircleIcon, HeartIcon, ArrowsClockwiseIcon, ShareNetworkIcon,
} from "phosphor-react-native";

type Props = {
  platform: PlatformId;
  content: string;
  imageUrl?: string | null;
  authorLabel?: string;
};

const PLATFORM_LABELS: Record<PlatformId, string> = {
  x: "X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  reddit: "Reddit",
};

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 100,
    },
    badgeText: { color: theme.textSupporting, fontSize: 11, fontWeight: "700" },
    card: {
      backgroundColor: theme.cardBG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.highlightBG,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: theme.textSupporting, fontWeight: "700", fontSize: 16 },
    handle: { color: theme.text, fontWeight: "700", fontSize: 14 },
    sub: { color: theme.placeholderText, fontSize: 12 },
    body: { color: theme.text, fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12 },
    media: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.highlightBG },
    mediaSquare: { width: "100%", aspectRatio: 1, backgroundColor: theme.highlightBG },
    engagement: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    redditPill: {
      alignSelf: "flex-start",
      marginHorizontal: 14,
      marginTop: 12,
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    redditPillText: { color: theme.textSupporting, fontSize: 11, fontWeight: "600" },
    linkedInBlock: {
      marginHorizontal: 14,
      marginBottom: 12,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.highlightBG,
    },
    linkedInLink: { color: theme.placeholderText, fontSize: 11 },
  });
}

function Avatar({ label, styles }: { label: string; styles: ReturnType<typeof makeStyles> }) {
  const initial = (label.replace(/^@/, "")[0] ?? "Y").toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

function EngagementRow({ theme, styles }: { theme: ThemeColors; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.engagement}>
      <ChatCircleIcon size={18} color={theme.placeholderText} />
      <HeartIcon size={18} color={theme.placeholderText} />
      <ArrowsClockwiseIcon size={18} color={theme.placeholderText} />
      <ShareNetworkIcon size={18} color={theme.placeholderText} />
    </View>
  );
}

export default function PlatformPreview({ platform, content, imageUrl, authorLabel = "you" }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const handle = authorLabel.startsWith("@") ? authorLabel : `@${authorLabel}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Preview · {PLATFORM_LABELS[platform]}</Text>
      </View>

      {platform === "x" && (
        <View style={styles.card}>
          <View style={styles.header}>
            <Avatar label={handle} styles={styles} />
            <View>
              <Text style={styles.handle}>{handle}</Text>
              <Text style={styles.sub}>Preview</Text>
            </View>
          </View>
          <Text style={styles.body}>{content}</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" /> : null}
          <EngagementRow theme={theme} styles={styles} />
        </View>
      )}

      {platform === "instagram" && (
        <View style={styles.card}>
          <View style={styles.header}>
            <Avatar label={handle} styles={styles} />
            <View>
              <Text style={styles.handle}>{handle.replace("@", "")}</Text>
              <Text style={styles.sub}>Suggested for you</Text>
            </View>
          </View>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.mediaSquare} resizeMode="cover" /> : null}
          <Text style={styles.body}>{content}</Text>
        </View>
      )}

      {platform === "linkedin" && (
        <View style={styles.card}>
          <View style={styles.header}>
            <Avatar label={handle} styles={styles} />
            <View>
              <Text style={styles.handle}>{handle.replace("@", "")}</Text>
              <Text style={styles.sub}>Creator · 1st</Text>
            </View>
          </View>
          <Text style={styles.body}>{content}</Text>
          {imageUrl ? (
            <View style={styles.linkedInBlock}>
              <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" />
              <Text style={styles.linkedInLink}>contai.app</Text>
            </View>
          ) : null}
        </View>
      )}

      {platform === "youtube" && (
        <View style={styles.card}>
          <View style={styles.header}>
            <Avatar label={handle} styles={styles} />
            <View>
              <Text style={styles.handle}>{handle.replace("@", "")}</Text>
              <Text style={styles.sub}>Community post</Text>
            </View>
          </View>
          <Text style={[styles.body, { fontWeight: "700" }]} numberOfLines={2}>
            {content.split("\n")[0]}
          </Text>
          <Text style={styles.body}>{content.split("\n").slice(1).join("\n") || content}</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" /> : null}
        </View>
      )}

      {platform === "reddit" && (
        <View style={styles.card}>
          <View style={styles.redditPill}>
            <Text style={styles.redditPillText}>r/contai</Text>
          </View>
          <Text style={[styles.body, { fontWeight: "700", paddingBottom: 4 }]}>
            {content.split("\n")[0]?.slice(0, 120)}
          </Text>
          <Text style={styles.body}>{content}</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.media} resizeMode="cover" /> : null}
        </View>
      )}

    </View>
  );
}
