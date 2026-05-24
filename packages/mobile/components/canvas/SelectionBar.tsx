import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  ArrowsOutIcon, SparkleIcon, CopyIcon, ShareNetworkIcon, ArrowsLeftRightIcon,
} from "phosphor-react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Share } from "react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { InspirationItem } from "../../store/canvasStore";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    bar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.highlightBG,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      padding: 16,
      gap: 10,
    },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    countText: { color: theme.success, fontWeight: "700", fontSize: 15 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 100,
      backgroundColor: theme.cardBG,
      borderWidth: 1,
      borderColor: theme.border,
    },
    btnPrimary: { backgroundColor: theme.success, borderColor: theme.success },
    btnText: { color: theme.textSupporting, fontSize: 13, fontWeight: "600" },
    btnTextPrimary: { color: theme.appBG, fontWeight: "700" },
    cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
    cancelText: { color: theme.textSupporting, fontSize: 14 },
  });
}

type Props = {
  selectedIds: string[];
  items: InspirationItem[];
  onCancel: () => void;
  onMerge: () => void;
  onRemix: (id: string) => void;
  onCompare: () => void;
};

export default function SelectionBar({
  selectedIds,
  items,
  onCancel,
  onMerge,
  onRemix,
  onCompare,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const selected = items.filter((i) => selectedIds.includes(i.id));
  const count = selectedIds.length;

  if (count === 0) return null;

  async function copyHook() {
    const hooks = selected.map((i) => i.hook).filter(Boolean).join("\n\n—\n\n");
    if (!hooks) return;
    await Clipboard.setStringAsync(hooks);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function shareSelected() {
    const text = selected
      .map((i) => `${i.title || i.rawContent.slice(0, 80)}\n${i.summary || ""}`)
      .join("\n\n---\n\n");
    await Share.share({ message: text });
  }

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Text style={styles.countText}>{count} selected</Text>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        {count === 1 ? (
          <>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => onRemix(selectedIds[0])}>
              <SparkleIcon size={14} color={theme.appBG} weight="fill" />
              <Text style={styles.btnTextPrimary}>Remix</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={copyHook}>
              <CopyIcon size={14} color={theme.textSupporting} />
              <Text style={styles.btnText}>Copy hook</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={shareSelected}>
              <ShareNetworkIcon size={14} color={theme.textSupporting} />
              <Text style={styles.btnText}>Share</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {count >= 2 ? (
          <>
            <TouchableOpacity style={styles.btn} onPress={onCompare}>
              <ArrowsLeftRightIcon size={14} color={theme.textSupporting} />
              <Text style={styles.btnText}>Compare</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onMerge}>
              <ArrowsOutIcon size={14} color={theme.appBG} weight="bold" />
              <Text style={styles.btnTextPrimary}>Merge</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}
