import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { typography } from "../../constants/typography";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.cardBG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 10,
      marginBottom: 12,
    },
    shimmer: {
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.highlightBG,
      width: "70%",
    },
    shimmerShort: {
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.highlightBG,
      width: "45%",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
    label: { ...typography.caption, color: theme.success, fontWeight: "600" },
  });
}

export default function AnalyzingCard() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.card}>
      <View style={styles.shimmer} />
      <View style={styles.shimmerShort} />
      <View style={styles.row}>
        <ActivityIndicator size="small" color={theme.success} />
        <Text style={styles.label}>Analyzing with AI…</Text>
      </View>
    </View>
  );
}
