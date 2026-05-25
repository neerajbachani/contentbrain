import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { authClient, clearToken } from "../../lib/auth";
import { ApiResponseError, apiRequest, formatApiError } from "../../lib/http";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  UserIcon, CrownIcon, SignOutIcon, BrainIcon, ArrowRightIcon, SunIcon, MoonIcon,
} from "phosphor-react-native";
import { useTheme, useThemeContext, useThemedStyles } from "../../theme";
import { colors } from "../../constants/colors";
import { variables } from "../../theme/variables";
import { Button, Text, TextInput } from "../../components/ui";
import type { ThemeColors } from "../../theme/types";

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

const THEME_OPTIONS = [
  { value: "dark" as const, label: "Dark", Icon: MoonIcon },
  { value: "light" as const, label: "Light", Icon: SunIcon },
  { value: "system" as const, label: "System", Icon: SunIcon },
];

function formatGrokConnectError(err: unknown) {
  const base = formatApiError(err, "Could not connect Grok");
  if (!(err instanceof ApiResponseError) || !err.body || typeof err.body !== "object") {
    return base;
  }

  const body = err.body as {
    upstreamStatus?: number | null;
    xaiModel?: string;
    reasonCode?: string;
  };
  const details = [
    body.upstreamStatus ? `xAI status: ${body.upstreamStatus}` : null,
    body.xaiModel ? `Model: ${body.xaiModel}` : null,
    body.reasonCode ? `Reason: ${body.reasonCode}` : null,
  ].filter(Boolean);

  return details.length > 0 ? `${base}\n${details.join("\n")}` : base;
}

function makeSettingsStyles(theme: ThemeColors) {
  return {
    safe: { flex: 1, backgroundColor: theme.appBG },
    content: { padding: variables.spacing4, gap: variables.spacing4 },
    headerTitle: { color: theme.text, marginBottom: variables.spacing2 },
    profileCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: variables.spacing3,
      backgroundColor: theme.cardBG,
      borderRadius: variables.componentBorderRadiusCard,
      borderWidth: 1,
      borderColor: theme.border,
      padding: variables.spacing4,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.highlightBG,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    userName: { color: theme.text },
    userEmail: { color: theme.textSupporting, fontSize: variables.fontSizeLabel },
    errorText: { color: theme.danger, fontSize: variables.fontSizeLabel, lineHeight: 18 },
    planBadge: {
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: variables.buttonBorderRadius,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    planBadgePremium: { backgroundColor: colors.green600 },
    planText: { color: theme.textSupporting, fontSize: 12, fontWeight: "600" as const },
    planTextPremium: { color: theme.buttonSuccessText },
    section: {
      backgroundColor: theme.cardBG,
      borderRadius: variables.componentBorderRadiusCard,
      borderWidth: 1,
      borderColor: theme.border,
      padding: variables.spacing4,
      gap: 10,
    },
    sectionTitle: { color: theme.text },
    sectionHint: { color: theme.placeholderText, fontSize: 12, lineHeight: 17 },
    sourceRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: variables.spacing2 },
    sourceChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: variables.buttonBorderRadius,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.highlightBG,
    },
    sourceChipActive: { borderColor: theme.success, backgroundColor: colors.green700 },
    sourceChipText: { color: theme.textSupporting, fontSize: variables.fontSizeLabel, fontWeight: "600" as const },
    sourceChipTextActive: { color: theme.buttonSuccessText },
    grokStatus: { color: theme.textSupporting, fontSize: variables.fontSizeLabel, fontWeight: "600" as const },
    disconnectBtn: {
      paddingVertical: 10,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: variables.componentBorderRadius,
    },
    disconnectBtnText: { color: theme.textSupporting, fontWeight: "600" as const, fontSize: variables.fontSizeLabel },
    setupHint: { color: theme.placeholderText, fontSize: 11, lineHeight: 16 },
    nicheGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: variables.spacing2 },
    nicheChip: {
      backgroundColor: theme.highlightBG,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: variables.buttonBorderRadius,
    },
    nicheChipText: { color: theme.success, fontSize: 12, fontWeight: "600" as const },
    emptyNiche: { color: theme.placeholderText, fontSize: variables.fontSizeLabel },
    editBtn: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: 4 },
    editBtnText: { color: theme.link, fontSize: variables.fontSizeNormal, fontWeight: "600" as const },
    usageRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
    usageLabel: { color: theme.textSupporting, fontSize: variables.fontSizeNormal },
    usageValue: { color: theme.text, fontSize: variables.fontSizeNormal, fontWeight: "600" as const },
    upgradeCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: variables.spacing3,
      backgroundColor: `${theme.success}15`,
      borderRadius: variables.componentBorderRadiusCard,
      borderWidth: 1,
      borderColor: colors.green600,
      padding: variables.spacing4,
    },
    upgradeTitle: { color: theme.text, fontWeight: "700" as const, fontSize: variables.fontSizeMedium },
    upgradeText: { color: theme.textSupporting, fontSize: 12 },
    aboutRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: variables.spacing2 },
    aboutTitle: { color: theme.text, fontWeight: "700" as const, fontSize: variables.fontSizeMedium },
    aboutText: { color: theme.textSupporting, fontSize: variables.fontSizeLabel },
    version: { color: theme.placeholderText, fontSize: 12 },
    signOutBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: variables.spacing2,
      padding: variables.spacing4,
      borderRadius: variables.componentBorderRadius,
      borderWidth: 1,
      borderColor: `${theme.danger}40`,
    },
    signOutText: { color: theme.danger, fontWeight: "600" as const, fontSize: variables.fontSizeMedium },
    themeRow: { flexDirection: "row" as const, gap: variables.spacing2 },
    themeChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: variables.buttonBorderRadius,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 4,
      backgroundColor: theme.highlightBG,
    },
    themeChipActive: { borderColor: theme.success, backgroundColor: theme.success },
    themeChipText: { color: theme.textSupporting, fontSize: variables.fontSizeLabel, fontWeight: "600" as const },
    themeChipTextActive: { color: theme.buttonSuccessText },
  };
}

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const client = api as any;
  const theme = useTheme();
  const { preference, setPreference } = useThemeContext();
  const styles = useThemedStyles(makeSettingsStyles);
  const [grokToken, setGrokToken] = useState("");
  const [connecting, setConnecting] = useState(false);

  const { data, isLoading, error: profileError } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      return apiRequest<{
        user: { id: string; name: string | null; email: string | null; image: string | null };
        profile: {
          niche?: string | null;
          plan?: string | null;
          xDataSource?: string | null;
          remixCount?: number | null;
          mergeCount?: number | null;
          trendCount?: number | null;
        };
        grokConnected?: boolean;
        isPremium?: boolean;
        limits?: {
          inspirations?: number | null;
          dailyRemixes?: number | null;
          dailyMerges?: number | null;
          dailyTrends?: number | null;
        };
      }>("GET", "/api/users/profile", () => client.users.profile.$get());
    },
  });

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
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
  try {
    niches = JSON.parse(profile?.niche || "[]");
  } catch {
    /* empty */
  }
  const limits = (data as { limits?: { inspirations?: number | null; dailyRemixes?: number | null; dailyMerges?: number | null; dailyTrends?: number | null } })?.limits;
  const isPremium = (data as { isPremium?: boolean })?.isPremium ?? profile?.plan === "premium";
  const xDataSource = (profile as { xDataSource?: string })?.xDataSource ?? "auto";
  const grokConnected = (data as { grokConnected?: boolean })?.grokConnected ?? false;
  const profileErrorMessage = profileError ? formatApiError(profileError, "Could not load profile") : "";

  async function updateXDataSource(value: string) {
    try {
      await apiRequest("PATCH", "/api/users/settings", () =>
        client.users.settings.$patch({ json: { xDataSource: value } })
      );
      await qc.invalidateQueries({ queryKey: ["profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Alert.alert("Error", formatApiError(err, "Could not update X data source"));
    }
  }

  async function connectGrok() {
    if (!grokToken.trim()) {
      Alert.alert("Token required", "Paste the full ~/.hermes/auth.json file (see docs/grok-setup.md)");
      return;
    }
    setConnecting(true);
    try {
      const body = await apiRequest<{
        message?: string;
        verified?: boolean;
        connected?: boolean;
        xaiModel?: string;
        xaiBaseUrl?: string;
      }>(
        "POST",
        "/api/integrations/xai/connect",
        () =>
          client.integrations.xai.connect.$post({
            json: { accessToken: grokToken.trim() },
          })
      );
      setGrokToken("");
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["inspirations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log("[GrokConnect] success", {
        xaiModel: body.xaiModel ?? null,
        xaiBaseUrl: body.xaiBaseUrl ?? null,
      });
      Alert.alert(
        "Connected",
        body.verified
          ? `Grok verified with live x_search on ${body.xaiModel ?? "the configured model"} — open Context again to refresh`
          : "Grok is ready for live X search"
      );
    } catch (err: unknown) {
      console.warn("[GrokConnect] failed", err);
      Alert.alert("Grok connection failed", formatGrokConnectError(err));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectGrok() {
    try {
      await apiRequest("DELETE", "/api/integrations/xai/disconnect", () =>
        client.integrations.xai.disconnect.$delete()
      );
      await qc.invalidateQueries({ queryKey: ["profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Alert.alert("Error", formatApiError(err, "Could not disconnect"));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text preset="headline" style={styles.headerTitle}>
          Settings
        </Text>
        {profileErrorMessage ? (
          <Text style={styles.errorText}>{profileErrorMessage}</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={theme.success} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.section}>
              <Text preset="headlineH2" style={styles.sectionTitle}>
                Appearance
              </Text>
              <View style={styles.themeRow}>
                {THEME_OPTIONS.map((opt) => {
                  const active = preference === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.themeChip, active && styles.themeChipActive]}
                      onPress={() => {
                        setPreference(opt.value);
                        Haptics.selectionAsync();
                      }}
                    >
                      <opt.Icon size={16} color={active ? theme.buttonSuccessText : theme.icon} />
                      <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <UserIcon size={28} color={theme.success} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text preset="headlineH2" style={styles.userName}>
                  {user?.name ?? "Creator"}
                </Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
              <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
                {isPremium && <CrownIcon size={12} color={theme.buttonSuccessText} weight="fill" />}
                <Text style={[styles.planText, isPremium && styles.planTextPremium]}>
                  {isPremium ? "Premium" : "Free"}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text preset="headlineH2" style={styles.sectionTitle}>
                Your Niches
              </Text>
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
              <TouchableOpacity style={styles.editBtn} onPress={() => router.push("/onboarding")}>
                <Text style={styles.editBtnText}>Edit Niches</Text>
                <ArrowRightIcon size={16} color={theme.link} />
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text preset="headlineH2" style={styles.sectionTitle}>
                X Data Source
              </Text>
              <Text style={styles.sectionHint}>
                Live X context for premium. Grok uses your subscription; Apify uses app credits.
              </Text>
              <View style={styles.sourceRow}>
                {X_SOURCE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.sourceChip, xDataSource === opt.value && styles.sourceChipActive]}
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

              <Text style={styles.grokStatus}>Grok: {grokConnected ? "Connected" : "Not connected"}</Text>
              {!grokConnected ? (
                <>
                  <TextInput
                    placeholder="Paste full ~/.hermes/auth.json"
                    value={grokToken}
                    onChangeText={setGrokToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <Button variant="success" onPress={connectGrok} isLoading={connecting} isDisabled={connecting}>
                    Connect Grok
                  </Button>
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

            <View style={styles.section}>
              <Text preset="headlineH2" style={styles.sectionTitle}>
                Daily Usage
              </Text>
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

            {!isPremium && (
              <View style={styles.upgradeCard}>
                <CrownIcon size={24} color={theme.success} weight="fill" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                  <Text style={styles.upgradeText}>Unlimited remixes, merges, trends & more</Text>
                </View>
                <Button
                  variant="success"
                  size="small"
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                >
                  $9.99/mo
                </Button>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.aboutRow}>
                <BrainIcon size={20} color={theme.success} weight="fill" />
                <Text style={styles.aboutTitle}>ContentBrain</Text>
              </View>
              <Text style={styles.aboutText}>Your AI-powered content creation OS</Text>
              <Text style={styles.version}>Version 1.0.0</Text>
            </View>

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <SignOutIcon size={18} color={theme.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
