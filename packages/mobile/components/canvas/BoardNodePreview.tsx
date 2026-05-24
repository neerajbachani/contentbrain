import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from "react-native";
import { XIcon, SparkleIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { typography } from "../../constants/typography";
import type { InspirationItem } from "../../store/canvasStore";
import { getPlatformMeta } from "./canvasUtils";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: theme.cardBG,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "55%",
      paddingBottom: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { ...typography.heading, color: theme.text, flex: 1, marginRight: 12 },
    platform: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
    body: { padding: 16, gap: 10 },
    summary: { color: theme.textSupporting, fontSize: 14, lineHeight: 20 },
    hook: {
      backgroundColor: theme.highlightBG,
      padding: 12,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: theme.success,
    },
    hookText: { color: theme.text, fontSize: 13, fontStyle: "italic", lineHeight: 18 },
    remixBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.success,
      marginHorizontal: 16,
      padding: 14,
      borderRadius: 100,
    },
    remixBtnText: { color: theme.appBG, fontWeight: "700", fontSize: 15 },
  });
}

type Props = {
  item: InspirationItem | null;
  onClose: () => void;
  onRemix: (id: string) => void;
};

export default function BoardNodePreview({ item, onClose, onRemix }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!item) return null;
  const meta = getPlatformMeta(item.sourcePlatform, theme.placeholderText);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title || item.rawContent.slice(0, 80)}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={22} color={theme.textSupporting} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.platform, { color: meta.color }]}>{meta.label}</Text>
            {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
            {item.hook ? (
              <View style={styles.hook}>
                <Text style={styles.hookText}>{item.hook}</Text>
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            style={styles.remixBtn}
            onPress={() => { onRemix(item.id); onClose(); }}
          >
            <SparkleIcon size={18} color={theme.appBG} weight="fill" />
            <Text style={styles.remixBtnText}>Remix with AI</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
