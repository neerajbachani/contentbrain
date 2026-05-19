import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { authClient, captureToken } from "../../lib/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrainIcon } from "phosphor-react-native";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";
import { Button, Text, TextInput } from "../../components/ui";

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.appBG },
        container: { flexGrow: 1, justifyContent: "center", padding: variables.spacing5 },
        logo: { alignItems: "center", marginBottom: 48 },
        appName: { marginTop: variables.spacing3 },
        tagline: { marginTop: 4, textAlign: "center" },
        form: { gap: variables.spacing3 },
        error: {
          color: theme.textError,
          fontSize: variables.fontSizeLabel,
          backgroundColor: `${theme.danger}20`,
          padding: 10,
          borderRadius: variables.componentBorderRadius,
        },
        footer: { flexDirection: "row", justifyContent: "center", marginTop: variables.spacing3 },
      }),
    [theme]
  );

  async function handleLogin() {
    if (!email || !password) {
      setError("Fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    const result = await authClient.signIn.email(
      { email, password },
      { onSuccess: captureToken }
    );
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Login failed");
    } else {
      router.replace("/(tabs)/canvas");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <BrainIcon size={48} color={theme.success} weight="fill" />
            <Text preset="headline" style={styles.appName}>
              ContentBrain
            </Text>
            <Text preset="supporting" color={theme.textSupporting} style={styles.tagline}>
              Your AI-powered content creation OS
            </Text>
          </View>

          <View style={styles.form}>
            <Text preset="headlineH1">Welcome back</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button variant="success" size="large" onPress={handleLogin} isLoading={loading} isDisabled={loading}>
              Sign In
            </Button>

            <View style={styles.footer}>
              <Text color={theme.textSupporting}>Don't have an account? </Text>
              <Link href="/(auth)/register">
                <Text color={theme.link} family="bold">
                  Sign Up
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
