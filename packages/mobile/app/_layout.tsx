import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { getToken } from "../lib/auth";
import { getApiBase } from "../lib/apiBase";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function logAuth(message: string, extra?: unknown) {
  if (extra !== undefined) {
    console.log(`[AuthGate] ${message}`, extra);
    return;
  }
  console.log(`[AuthGate] ${message}`);
}

function AuthGate() {
  const API_BASE = getApiBase();

  useEffect(() => {
    logAuth("resolved API_BASE", { API_BASE });
  }, [API_BASE]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["session-check", API_BASE],
    queryFn: async () => {
      const token = getToken();
      const targetUrl = `${API_BASE}/api/auth/get-session`;

      logAuth("session fetch start", {
        targetUrl,
        hasToken: Boolean(token),
      });

      try {
        const res = await fetch(targetUrl, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "expo-origin": "mobile://",
          },
        });
        logAuth("session fetch response", { status: res.status, ok: res.ok });
        if (!res.ok) return null;
        const json = await res.json() as { user?: unknown } | null;
        logAuth("session fetch json", json);
        return json;
      } catch (err) {
        logAuth("session fetch error", {
          name: (err as Error)?.name,
          message: (err as Error)?.message,
        });
        throw err;
      }
    },
    retry: 1,
    staleTime: 0,
  });
  const segments = useSegments();
  const router = useRouter();
  const session = (data as any)?.user ?? null;
  const hasToken = Boolean(getToken());

  useEffect(() => {
    logAuth("state update", {
      isPending,
      isError,
      hasSession: Boolean(session),
      hasToken,
      segment0: segments[0] ?? null,
      error: isError ? (error as Error)?.message : null,
    });
    if (isPending) return;

    const inAuth = segments[0] === "(auth)";
    const inTabs = segments[0] === "(tabs)";
    const inStack = segments[0] === "remix" || segments[0] === "merge" || segments[0] === "onboarding";

    if (isError) {
      if (hasToken && !inTabs && !inStack) {
        logAuth("session check failed but token exists -> /(tabs)/canvas");
        router.replace("/(tabs)/canvas");
      } else if (!hasToken && !inAuth) {
        logAuth("session check failed, no token -> /(auth)/login");
        router.replace("/(auth)/login");
      }
      return;
    }

    if (!session && !inAuth && !hasToken) {
      logAuth("redirect -> /(auth)/login");
      router.replace("/(auth)/login");
    } else if (session && !inTabs && !inStack) {
      logAuth("redirect -> /(tabs)/canvas");
      router.replace("/(tabs)/canvas");
    }
  }, [session, isPending, isError, segments, router, error, hasToken]);

  return (
    <>
      <Slot />
      {isPending || (isError && !segments[0]) ? (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#C8FF00" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#0A0A0A" />
        <AuthGate />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
