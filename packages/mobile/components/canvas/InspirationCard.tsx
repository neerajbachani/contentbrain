import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Image,
} from "react-native";
import {
  TwitterLogoIcon, RedditLogoIcon, InstagramLogoIcon, TrashIcon,
  SparkleIcon, CheckCircleIcon, YoutubeLogo, GlobeIcon, CaretDownIcon,
  CaretUpIcon, CopyIcon,
} from "phosphor-react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { InspirationItem } from "../../store/canvasStore";
import { getPlatformMeta } from "./canvasUtils";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.cardBG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    cardNoImage: { padding: 14, gap: 10 },
    imageContainer: { width: "100%", height: 200, position: "relative" },
    cardImage: { width: "100%", height: "100%", backgroundColor: theme.highlightBG },
    platformBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
      borderWidth: 1,
    },
    platformBadgeText: { fontSize: 11, fontWeight: "700" },
    deleteOverlay: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: theme.appBG + "CC",
      alignItems: "center",
      justifyContent: "center",
    },
    selectedOverlay: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.success + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: { padding: 14, gap: 8 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    platformRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    platformLabel: { fontSize: 12, fontWeight: "600" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    cardTitle: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
    cardSummary: { color: theme.textSupporting, fontSize: 13, lineHeight: 18 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: { backgroundColor: theme.highlightBG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
    tagText: { color: theme.placeholderText, fontSize: 11 },
    typeBadge: {
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      alignSelf: "flex-start",
    },
    typeBadgeText: { color: theme.placeholderText, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
    remixBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.success,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 100,
    },
    remixBtnFull: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.success,
      paddingVertical: 10,
      borderRadius: 100,
      marginTop: 2,
    },
    remixBtnText: { color: theme.appBG, fontSize: 13, fontWeight: "700" },
    cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
    expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
    expandBtnText: { color: theme.textSupporting, fontSize: 12, fontWeight: "600" },
    expandedBlock: { gap: 8, paddingTop: 4 },
    hookBox: {
      backgroundColor: theme.highlightBG,
      padding: 10,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: theme.success,
      gap: 6,
    },
    hookLabel: { fontSize: 10, fontWeight: "700", color: theme.success, letterSpacing: 0.5 },
    hookText: { color: theme.text, fontSize: 13, lineHeight: 18, fontStyle: "italic" },
    styleText: { color: theme.placeholderText, fontSize: 12 },
    ideaChip: {
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ideaChipText: { color: theme.text, fontSize: 11 },
    gridCompact: { padding: 10, gap: 6, minHeight: 120, flex: 1 },
    gridTitle: { color: theme.text, fontSize: 12, fontWeight: "700", lineHeight: 16 },
    gridImage: { width: "100%", height: 90, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  });
}

function PlatformIcon({ platform, size = 14, color }: { platform: string; size?: number; color?: string }) {
  const theme = useTheme();
  const meta = getPlatformMeta(platform, theme.placeholderText);
  const c = color ?? meta.color;
  const p = platform?.toLowerCase();
  const Icon =
    p === "twitter" || p === "x" ? TwitterLogoIcon
      : p === "reddit" ? RedditLogoIcon
        : p === "instagram" ? InstagramLogoIcon
          : p === "youtube" ? YoutubeLogo
            : GlobeIcon;
  return <Icon size={size} color={c} weight="fill" />;
}

function TypeBadge({ type, styles }: { type: string; styles: ReturnType<typeof makeStyles> }) {
  if (!type || type === "text") return null;
  return (
    <View style={styles.typeBadge}>
      <Text style={styles.typeBadgeText}>{type.toUpperCase()}</Text>
    </View>
  );
}

export type InspirationCardProps = {
  item: InspirationItem;
  isSelected: boolean;
  isExpanded: boolean;
  compact?: boolean;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
  onLongPress: () => void;
  onRemix: () => void;
  onDelete: () => void;
  onToggleExpand: () => void;
  onTagPress: (tag: string) => void;
  onPlatformPress: (platform: string) => void;
  onImageDoublePress?: () => void;
};

export default function InspirationCard({
  item,
  isSelected,
  isExpanded,
  compact,
  styles,
  onPress,
  onLongPress,
  onRemix,
  onDelete,
  onToggleExpand,
  onTagPress,
  onPlatformPress,
  onImageDoublePress,
}: InspirationCardProps) {
  const theme = useTheme();
  const tags = item.tags ?? [];
  const keyIdeas = item.keyIdeas ?? [];
  const meta = getPlatformMeta(item.sourcePlatform, theme.placeholderText);
  const hasImage = !!item.ogImage;
  const hasExpandable = !!(item.summary || keyIdeas.length || item.hook || item.writingStyle);

  async function copyHook() {
    if (!item.hook) return;
    await Clipboard.setStringAsync(item.hook);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const expandedSection = isExpanded && hasExpandable ? (
    <View style={styles.expandedBlock}>
      {item.summary ? <Text style={styles.cardSummary}>{item.summary}</Text> : null}
      {item.hook ? (
        <View style={styles.hookBox}>
          <Text style={styles.hookLabel}>HOOK</Text>
          <Text style={styles.hookText}>{item.hook}</Text>
          <TouchableOpacity onPress={copyHook} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <CopyIcon size={12} color={theme.success} />
            <Text style={{ color: theme.success, fontSize: 11, fontWeight: "600" }}>Copy hook</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {item.writingStyle ? (
        <Text style={styles.styleText}>Style: {item.writingStyle}</Text>
      ) : null}
      {keyIdeas.length > 0 ? (
        <View style={styles.tagRow}>
          {keyIdeas.map((idea) => (
            <TouchableOpacity key={idea} style={styles.ideaChip} onPress={() => onTagPress(idea)}>
              <Text style={styles.ideaChipText}>{idea}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  if (compact) {
    return (
      <Pressable
        style={[
          styles.card,
          isSelected && { borderColor: theme.success, borderWidth: 2 },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        {hasImage ? (
          <Pressable onPress={onImageDoublePress}>
            <Image source={{ uri: item.ogImage! }} style={styles.gridImage} resizeMode="cover" />
          </Pressable>
        ) : null}
        <View style={styles.gridCompact}>
          <TouchableOpacity onPress={() => onPlatformPress(item.sourcePlatform)} style={styles.platformRow}>
            <PlatformIcon platform={item.sourcePlatform} size={12} />
            <Text style={[styles.platformLabel, { color: meta.color, fontSize: 10 }]}>{meta.label}</Text>
          </TouchableOpacity>
          <Text style={styles.gridTitle} numberOfLines={3}>
            {item.title || item.rawContent}
          </Text>
          {isSelected ? <CheckCircleIcon size={16} color={theme.success} weight="fill" /> : null}
        </View>
      </Pressable>
    );
  }

  if (hasImage) {
    return (
      <Pressable
        style={[styles.card, isSelected && { borderColor: theme.success, borderWidth: 2 }]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Pressable onPress={onImageDoublePress}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.ogImage! }} style={styles.cardImage} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.platformBadge, { backgroundColor: meta.color + "22", borderColor: meta.color + "44" }]}
              onPress={() => onPlatformPress(item.sourcePlatform)}
            >
              <PlatformIcon platform={item.sourcePlatform} size={12} />
              <Text style={[styles.platformBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteOverlay} onPress={onDelete} hitSlop={8}>
              <TrashIcon size={14} color={theme.placeholderText} />
            </TouchableOpacity>
            {isSelected ? (
              <View style={styles.selectedOverlay}>
                <CheckCircleIcon size={28} color={theme.success} weight="fill" />
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={isExpanded ? undefined : 2}>
              {item.title || item.rawContent}
            </Text>
            <TypeBadge type={item.type} styles={styles} />
          </View>

          {!isExpanded && item.summary ? (
            <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
          ) : null}

          {expandedSection}

          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.slice(0, isExpanded ? 8 : 3).map((t) => (
                <TouchableOpacity key={t} style={styles.tag} onPress={() => onTagPress(t)}>
                  <Text style={styles.tagText}>#{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.cardActions}>
            {hasExpandable ? (
              <TouchableOpacity style={styles.expandBtn} onPress={onToggleExpand}>
                {isExpanded ? <CaretUpIcon size={14} color={theme.textSupporting} /> : <CaretDownIcon size={14} color={theme.textSupporting} />}
                <Text style={styles.expandBtnText}>{isExpanded ? "Less" : "Details"}</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
              <SparkleIcon size={13} color={theme.appBG} weight="fill" />
              <Text style={styles.remixBtnText}>Remix</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.card,
        styles.cardNoImage,
        { borderLeftColor: isSelected ? theme.success : meta.color, borderLeftWidth: 4 },
        isSelected && { borderColor: theme.success, borderWidth: 2, borderLeftWidth: 4 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.cardHeader}>
        <TouchableOpacity style={styles.platformRow} onPress={() => onPlatformPress(item.sourcePlatform)}>
          <PlatformIcon platform={item.sourcePlatform} size={14} />
          <Text style={[styles.platformLabel, { color: meta.color }]}>{meta.label}</Text>
          <TypeBadge type={item.type} styles={styles} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {isSelected && <CheckCircleIcon size={16} color={theme.success} weight="fill" />}
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <TrashIcon size={14} color={theme.placeholderText} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={isExpanded ? undefined : 3}>
        {item.title || item.rawContent}
      </Text>

      {!isExpanded && item.summary ? (
        <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
      ) : null}

      {expandedSection}

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.slice(0, isExpanded ? 8 : 3).map((t) => (
            <TouchableOpacity key={t} style={styles.tag} onPress={() => onTagPress(t)}>
              <Text style={styles.tagText}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.cardActions}>
        {hasExpandable ? (
          <TouchableOpacity style={styles.expandBtn} onPress={onToggleExpand}>
            {isExpanded ? <CaretUpIcon size={14} color={theme.textSupporting} /> : <CaretDownIcon size={14} color={theme.textSupporting} />}
            <Text style={styles.expandBtnText}>{isExpanded ? "Less" : "Details"}</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity style={styles.remixBtn} onPress={onRemix}>
          <SparkleIcon size={13} color={theme.appBG} weight="fill" />
          <Text style={styles.remixBtnText}>Remix</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

export { makeStyles as makeCardStyles };
