import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from "react-native";
import { XIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";
import { typography } from "../../constants/typography";
import { FILTERS } from "./canvasUtils";

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: theme.cardBG,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 32,
      maxHeight: "60%",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: { ...typography.heading, color: theme.text },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.textSupporting,
      marginBottom: 8,
      marginTop: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.highlightBG,
    },
    chipActive: { backgroundColor: theme.success, borderColor: theme.success },
    chipText: { color: theme.textSupporting, fontSize: 13 },
    chipTextActive: { color: theme.appBG, fontWeight: "700" },
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  filter: string;
  onFilterChange: (f: string) => void;
  tagFilter: string | null;
  onTagFilterChange: (t: string | null) => void;
  availableTags: string[];
};

export default function CanvasFiltersSheet({
  visible,
  onClose,
  filter,
  onFilterChange,
  tagFilter,
  onTagFilterChange,
  availableTags,
}: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={22} color={theme.textSupporting} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.row}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, filter === f && styles.chipActive]}
                  onPress={() => onFilterChange(f)}
                >
                  <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {availableTags.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Tags</Text>
                <View style={styles.row}>
                  {availableTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.chip, tagFilter === tag && styles.chipActive]}
                      onPress={() => onTagFilterChange(tagFilter === tag ? null : tag)}
                    >
                      <Text style={[styles.chipText, tagFilter === tag && styles.chipTextActive]}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
