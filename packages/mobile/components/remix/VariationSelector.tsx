import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import type { RemixVariation } from "../../types/remix";

const CHIP_LABELS = ["1", "2", "3"];

type Props = {
  variations: RemixVariation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 10 },
    label: { color: theme.textSupporting, fontSize: 13, fontWeight: "600" },
    row: { gap: 8, paddingVertical: 2 },
    chip: {
      minWidth: 72,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBG,
      gap: 4,
    },
    chipActive: { borderColor: theme.success, backgroundColor: theme.highlightBG },
    chipNum: { color: theme.placeholderText, fontSize: 11, fontWeight: "700" },
    chipNumActive: { color: theme.success },
    chipTitle: { color: theme.text, fontSize: 12, fontWeight: "600", maxWidth: 140 },
    chipTitleActive: { color: theme.success },
    snippet: {
      backgroundColor: theme.cardBG,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
    },
    snippetLabel: { color: theme.textSupporting, fontSize: 12, fontWeight: "600", marginBottom: 4 },
    snippetText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  });
}

export default function VariationSelector({ variations, selectedIndex, onSelect }: Props) {
  const styles = useThemedStyles(makeStyles);
  const selected = variations[selectedIndex];

  function select(i: number) {
    onSelect(i);
    Haptics.selectionAsync();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Pick a variation</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {variations.map((v, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.chip, selectedIndex === i && styles.chipActive]}
            onPress={() => select(i)}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipNum, selectedIndex === i && styles.chipNumActive]}>
              Var {CHIP_LABELS[i] ?? i + 1}
            </Text>
            <Text
              style={[styles.chipTitle, selectedIndex === i && styles.chipTitleActive]}
              numberOfLines={1}
            >
              {v.label || `Variation ${i + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {selected && (
        <View style={styles.snippet}>
          <Text style={styles.snippetLabel}>{selected.label}</Text>
          <Text style={styles.snippetText} numberOfLines={4}>
            {selected.content}
          </Text>
        </View>
      )}
    </View>
  );
}
