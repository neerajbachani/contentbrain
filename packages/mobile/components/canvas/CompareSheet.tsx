import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native";
import { XIcon } from "phosphor-react-native";
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
      maxHeight: "85%",
      paddingBottom: 32,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { ...typography.heading, color: theme.text },
    scroll: { padding: 16 },
    columns: { flexDirection: "row", gap: 12 },
    column: { flex: 1, gap: 8 },
    colTitle: { fontSize: 13, fontWeight: "700", color: theme.success },
    platform: { fontSize: 11, color: theme.placeholderText },
    summary: { fontSize: 12, color: theme.textSupporting, lineHeight: 17 },
    idea: {
      fontSize: 11,
      color: theme.text,
      backgroundColor: theme.highlightBG,
      padding: 6,
      borderRadius: 6,
    },
    mergeHint: {
      margin: 16,
      marginTop: 0,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.highlightBG,
    },
    mergeHintText: { fontSize: 12, color: theme.textSupporting, lineHeight: 18 },
  });
}

type Props = {
  visible: boolean;
  items: InspirationItem[];
  onClose: () => void;
  onMerge: () => void;
};

export default function CompareSheet({ visible, items, onClose, onMerge }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const pairs = items.slice(0, 4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Compare ({pairs.length})</Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={22} color={theme.textSupporting} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.columns}>
              {pairs.map((item) => {
                const meta = getPlatformMeta(item.sourcePlatform, theme.placeholderText);
                return (
                  <View key={item.id} style={styles.column}>
                    <Text style={styles.colTitle} numberOfLines={2}>
                      {item.title || item.rawContent.slice(0, 40)}
                    </Text>
                    <Text style={styles.platform}>{meta.label}</Text>
                    {item.summary ? (
                      <Text style={styles.summary} numberOfLines={6}>
                        {item.summary}
                      </Text>
                    ) : null}
                    {(item.keyIdeas ?? []).slice(0, 4).map((idea) => (
                      <Text key={idea} style={styles.idea}>
                        {idea}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
            {items.length >= 2 ? (
              <View style={styles.mergeHint}>
                <Text style={styles.mergeHintText}>
                  Look for overlapping themes in key ideas before merging. Tap Merge in the selection bar when ready.
                </Text>
                {items.length >= 2 ? (
                  <TouchableOpacity onPress={onMerge} style={{ marginTop: 10 }}>
                    <Text style={{ color: theme.success, fontWeight: "700" }}>Continue to Merge →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
