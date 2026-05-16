import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import { typography } from "../constants/typography";
import { api } from "../lib/api";

const NICHES = [
  "Tech", "Finance", "Fitness", "Beauty", "Food", "Gaming",
  "Travel", "Fashion", "Mental Health", "Education", "Humor",
  "Crypto", "Business", "Lifestyle", "Sports",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(niche: string) {
    setSelected((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : prev.length < 5
        ? [...prev, niche]
        : prev
    );
  }

  async function handleDone() {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await api.users.niche.$patch({ json: { niche: selected.map((n) => n.toLowerCase()) } });
    } catch {}
    setLoading(false);
    router.replace("/(tabs)/canvas");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>What's your niche?</Text>
        <Text style={styles.subtitle}>Pick 1–5 topics you create content about</Text>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {NICHES.map((niche) => {
            const isSelected = selected.includes(niche);
            return (
              <TouchableOpacity
                key={niche}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggle(niche)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {niche}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
          onPress={handleDone}
          disabled={selected.length === 0 || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.btnText}>
              {selected.length === 0 ? "Select at least 1" : `Continue with ${selected.length} niche${selected.length > 1 ? "s" : ""}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { ...typography.displayMedium, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
  chipTextSelected: { color: colors.background, fontWeight: "700" },
  btn: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: colors.border },
  btnText: { color: colors.background, fontWeight: "700", fontSize: 16 },
});
