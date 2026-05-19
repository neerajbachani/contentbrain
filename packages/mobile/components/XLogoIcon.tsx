import { Text, StyleSheet } from "react-native";

/** Official-style X mark (not legacy Twitter bird). */
export function XLogoIcon({
  size = 16,
  color = "#F5F5F0",
}: {
  size?: number;
  color?: string;
}) {
  return <Text style={[styles.x, { fontSize: size, color, lineHeight: size + 2 }]}>𝕏</Text>;
}

const styles = StyleSheet.create({
  x: {
    fontWeight: "900",
    includeFontPadding: false,
  },
});
