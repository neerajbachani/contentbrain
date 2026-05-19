import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useTheme } from "../theme";
import { variables } from "../theme/variables";
import { Button, Text } from "../components/ui";

const NICHES = [
  "Tech", "Finance", "Fitness", "Beauty", "Food", "Gaming",
  "Travel", "Fashion", "Mental Health", "Education", "Humor",
  "Crypto", "Business", "Lifestyle", "Sports",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.appBG },
        container: { flex: 1, padding: variables.spacing5, gap: variables.spacing4 },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: variables.spacing2 },
        chip: {
          paddingHorizontal: variables.spacing4,
          paddingVertical: 10,
          borderRadius: variables.buttonBorderRadius,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardBG,
        },
        chipSelected: {
          backgroundColor: theme.success,
          borderColor: theme.success,
        },
        chipText: { fontSize: variables.fontSizeLabel },
        chipTextSelected: { color: theme.buttonSuccessText },
      }),
    [theme]
  );

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
    } catch {
      /* continue */
    }
    setLoading(false);
    router.replace("/(tabs)/canvas");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text preset="headline">What's your niche?</Text>
        <Text preset="body" color={theme.textSupporting}>
          Pick 1–5 topics you create content about
        </Text>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {NICHES.map((niche) => {
            const isSelected = selected.includes(niche);
            return (
              <Pressable
                key={niche}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggle(niche)}
              >
                <Text
                  family={isSelected ? "bold" : "regular"}
                  color={isSelected ? theme.buttonSuccessText : theme.textSupporting}
                  style={isSelected ? styles.chipTextSelected : styles.chipText}
                >
                  {niche}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Button
          variant="success"
          size="large"
          onPress={handleDone}
          isLoading={loading}
          isDisabled={selected.length === 0 || loading}
        >
          {selected.length === 0
            ? "Select at least 1"
            : `Continue with ${selected.length} niche${selected.length > 1 ? "s" : ""}`}
        </Button>
      </View>
    </SafeAreaView>
  );
}
