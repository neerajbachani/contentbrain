import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from "react-native";
import { useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, captureToken, sessionCheckQueryKey } from "../../lib/auth";
import { getApiBase } from "../../lib/apiBase";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";
import { Button, Text, TextInput } from "../../components/ui";

export default function RegisterScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.appBG },
        container: { flexGrow: 1, justifyContent: "center", padding: variables.spacing5 },
        logo: { alignItems: "center", marginBottom: 40 },
        logoImage: { width: 92, height: 92 },
        appName: { marginTop: variables.spacing2 },
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

  async function handleRegister() {
    if (!name || !email || !password) {
      setError("Fill in all fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const result = await authClient.signUp.email(
      { name, email, password },
      { onSuccess: captureToken }
    );
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Registration failed");
    } else {
      await qc.invalidateQueries({ queryKey: sessionCheckQueryKey(getApiBase()) });
      router.replace("/onboarding");
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
            <Image
              source={require("../../assets/app-icon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text preset="headline" style={styles.appName}>
              Contai
            </Text>
          </View>

          <View style={styles.form}>
            <Text preset="headlineH1">Create account</Text>
            <Text preset="supporting" color={theme.textSupporting}>
              Start capturing and remixing content
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              placeholder="Password (min. 8 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button variant="success" size="large" onPress={handleRegister} isLoading={loading} isDisabled={loading}>
              Create Account
            </Button>

            <View style={styles.footer}>
              <Text color={theme.textSupporting}>Already have an account? </Text>
              <Link href="/(auth)/login">
                <Text color={theme.link} family="bold">
                  Sign In
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
