import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinkIcon, XIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.highlightBG,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    text: { flex: 1, color: theme.text, fontSize: 13, fontWeight: "500" },
    addBtn: {
      backgroundColor: theme.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
    },
    addBtnText: { color: theme.appBG, fontSize: 12, fontWeight: "700" },
  });
}

type Props = {
  url: string;
  onAdd: () => void;
  onDismiss: () => void;
};

export default function ClipboardBanner({ url, onAdd, onDismiss }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const display = url.length > 48 ? `${url.slice(0, 45)}…` : url;

  return (
    <View style={styles.banner}>
      <LinkIcon size={18} color={theme.success} />
      <Text style={styles.text} numberOfLines={1}>
        Add link from clipboard? {display}
      </Text>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>Add</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={8}>
        <XIcon size={18} color={theme.placeholderText} />
      </TouchableOpacity>
    </View>
  );
}
