import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

const X_SOURCE_OPTIONS = [
  { value: "auto", label: "Auto", hint: "Grok if connected, else Apify" },
  { value: "xai", label: "Grok", hint: "Your X subscription" },
  { value: "apify", label: "Apify", hint: "App credits" },
] as const;

const NICHE_LABELS: Record<string, string> = {
  tech: "Tech", finance: "Finance", fitness: "Fitness", beauty: "Beauty",
  food: "Food", gaming: "Gaming", travel: "Travel", fashion: "Fashion",
  mentalhealth: "Mental Health", education: "Education", humor: "Humor",
  crypto: "Crypto", business: "Business", lifestyle: "Lifestyle", sports: "Sports",
};

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [grokToken, setGrokToken] = useState("");
  const [connecting, setConnecting] = useState(false);

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
  const limits = (data as { limits?: { inspirations?: number | null; dailyRemixes?: number | null; dailyMerges?: number | null; dailyTrends?: number | null } })?.limits;
  const isPremium = (data as { isPremium?: boolean })?.isPremium ?? profile?.plan === "premium";
  const xDataSource = (profile as { xDataSource?: string })?.xDataSource ?? "auto";
  const grokConnected = (data as { grokConnected?: boolean })?.grokConnected ?? false;

  async function updateXDataSource(value: string) {
    try {
      const res = await api.users.settings.$patch({ json: { xDataSource: value } });
      if (!res.ok) throw new Error("Failed");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not update X data source");
    }
  }

  async function connectGrok() {
    if (!grokToken.trim()) {
      Alert.alert("Token required", "Paste the full ~/.hermes/auth.json file (see docs/grok-setup.md)");
      return;
    }
    setConnecting(true);
    try {
      const res = await api.integrations.xai.connect.$post({
        json: { accessToken: grokToken.trim() },
      });
      const body = (await res.json()) as { message?: string; verified?: boolean };
      if (!res.ok) {
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setGrokToken("");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["inspirations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Connected",
        body.verified
          ? "Grok verified with live x_search — open Context again to refresh"
          : "Grok is ready for live X search"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not connect Grok";
      Alert.alert("Grok connection failed", msg);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectGrok() {
    try {
      await api.integrations.xai.disconnect.$delete();
      await qc.invalidateQueries({ queryKey: ["profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not disconnect");
    }
  }

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

            {/* X data source */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>X Data Source</Text>
              <Text style={styles.sectionHint}>
                Live X context for premium. Grok uses your subscription; Apify uses app credits.
              </Text>
              <View style={styles.sourceRow}>
                {X_SOURCE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.sourceChip,
                      xDataSource === opt.value && styles.sourceChipActive,
                    ]}
                    onPress={() => updateXDataSource(opt.value)}
                  >
                    <Text
                      style={[
                        styles.sourceChipText,
                        xDataSource === opt.value && styles.sourceChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.grokStatus}>
                Grok: {grokConnected ? "Connected" : "Not connected"}
              </Text>
              {!grokConnected ? (
                <>
                  <TextInput
                    style={styles.tokenInput}
                    placeholder="Paste full ~/.hermes/auth.json"
                    placeholderTextColor={colors.textTertiary}
                    value={grokToken}
                    onChangeText={setGrokToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <TouchableOpacity
                    style={styles.connectBtn}
                    onPress={connectGrok}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text style={styles.connectBtnText}>Connect Grok</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.setupHint}>
                    Setup: install Hermes → hermes auth add xai-oauth → copy token from ~/.hermes/auth.json
                  </Text>
                </>
              ) : (
                <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectGrok}>
                  <Text style={styles.disconnectBtnText}>Disconnect Grok</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Usage */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Usage</Text>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Remixes</Text>
                <Text style={styles.usageValue}>
                  {profile?.remixCount ?? 0} / {isPremium ? "∞" : (limits?.dailyRemixes ?? 20)}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Merges</Text>
                <Text style={styles.usageValue}>
                  {profile?.mergeCount ?? 0} / {isPremium ? "∞" : (limits?.dailyMerges ?? 10)}
                </Text>
              </View>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Trend fetches</Text>
                <Text style={styles.usageValue}>
                  {profile?.trendCount ?? 0} / {isPremium ? "∞" : (limits?.dailyTrends ?? 20)}
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
  sectionHint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },
  sourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sourceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sourceChipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  sourceChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  sourceChipTextActive: { color: colors.background },
  grokStatus: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  tokenInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 13,
    backgroundColor: colors.surfaceElevated,
  },
  connectBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  connectBtnText: { color: colors.background, fontWeight: "700", fontSize: 14 },
  disconnectBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  disconnectBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  setupHint: { color: colors.textTertiary, fontSize: 11, lineHeight: 16 },
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
