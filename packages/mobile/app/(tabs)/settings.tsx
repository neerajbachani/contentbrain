import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { typography } from "../../constants/typography";
import { api } from "../../lib/api";
import { authClient, clearToken } from "../../lib/auth";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  UserIcon, CrownIcon, SignOutIcon, BrainIcon, ArrowRightIcon,
} from "phosphor-react-native";

const NICHE_LABELS: Record<string, string> = {
  tech: "Tech", finance: "Finance", fitness: "Fitness", beauty: "Beauty",
  food: "Food", gaming: "Gaming", travel: "Travel", fashion: "Fashion",
  mentalhealth: "Mental Health", education: "Education", humor: "Humor",
  crypto: "Crypto", business: "Business", lifestyle: "Lifestyle", sports: "Sports",
};

export default function SettingsScreen() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await api.users.profile.$get();
      const d = await res.json();
      return "user" in d ? d : null;
    },
  });

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          await clearToken();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const user = data?.user;
  const profile = data?.profile;
  let niches: string[] = [];
  try { niches = JSON.parse(profile?.niche || "[]"); } catch {}
  const isPremium = profile?.plan === "premium";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Settings</Text>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Profile card */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <UserIcon size={28} color={colors.accent} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.name ?? "Creator"}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
              <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
                {isPremium && <CrownIcon size={12} color={colors.background} weight="fill" />}
                <Text style={[styles.planText, isPremium && styles.planTextPremium]}>
                  {isPremium ? "Premium" : "Free"}
                </Text>
              </View>
            </View>

            {/* Niches */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Niches</Text>
              <View style={styles.nicheGrid}>
                {niches.length === 0 ? (
                  <Text style={styles.emptyNiche}>No niches set</Text>
                ) : (
                  niches.map((n) => (
                    <View key={n} style={styles.nicheChip}>
                      <Text style={styles.nicheChipText}>{NICHE_LABELS[n] ?? n}</Text>
                    </View>
                  ))
                )}
              </View>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push("/onboarding")}
              >
                <Text style={styles.editBtnText}>Edit Niches</Text>
                <ArrowRightIcon size={16} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Usage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Usage</Text>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Remixes</Text>
                <Text style={styles.usageValue}>
                  {profile?.remixCount ?? 0} / {isPremium ? "∞" : "5"}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Merges</Text>
                <Text style={styles.usageValue}>
                  {profile?.mergeCount ?? 0} / {isPremium ? "∞" : "2"}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Trend fetches</Text>
                <Text style={styles.usageValue}>
                  {profile?.trendCount ?? 0} / {isPremium ? "∞" : "5"}
                </Text>
              </View>
            </View>

            {/* Upgrade CTA */}
            {!isPremium && (
              <View style={styles.upgradeCard}>
                <CrownIcon size={24} color={colors.accent} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                  <Text style={styles.upgradeText}>Unlimited remixes, merges, trends & more</Text>
                </View>
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                >
                  <Text style={styles.upgradeBtnText}>$9.99/mo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* About */}
            <View style={styles.section}>
              <View style={styles.aboutRow}>
                <BrainIcon size={20} color={colors.accent} weight="fill" />
                <Text style={styles.aboutTitle}>ContentBrain</Text>
              </View>
              <Text style={styles.aboutText}>Your AI-powered content creation OS</Text>
              <Text style={styles.version}>Version 1.0.0</Text>
            </View>

            {/* Sign out */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <SignOutIcon size={18} color={colors.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16 },
  headerTitle: { ...typography.displayMedium, color: colors.textPrimary, marginBottom: 8 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  userName: { ...typography.subheading, color: colors.textPrimary },
  userEmail: { color: colors.textSecondary, fontSize: 13 },
  planBadge: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, flexDirection: "row", alignItems: "center", gap: 4 },
  planBadgePremium: { backgroundColor: colors.accentDim },
  planText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  planTextPremium: { color: colors.background },
  section: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  sectionTitle: { ...typography.subheading, color: colors.textPrimary },
  nicheGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nicheChip: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  nicheChipText: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  emptyNiche: { color: colors.textTertiary, fontSize: 13 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  editBtnText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  usageRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageLabel: { color: colors.textSecondary, fontSize: 14 },
  usageValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  upgradeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.accent + "15", borderRadius: 16, borderWidth: 1, borderColor: colors.accentDim, padding: 16 },
  upgradeTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  upgradeText: { color: colors.textSecondary, fontSize: 12 },
  upgradeBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  upgradeBtnText: { color: colors.background, fontWeight: "700", fontSize: 13 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  aboutTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
  aboutText: { color: colors.textSecondary, fontSize: 13 },
  version: { color: colors.textTertiary, fontSize: 12 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.danger + "40" },
  signOutText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
});
