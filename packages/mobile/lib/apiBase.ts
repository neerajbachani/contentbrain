import Constants from "expo-constants";

const API_PORT = 5173;

/**
 * In Expo Go, Metro and the phone already share the same LAN host.
 * Derive API base from that host so Wi‑Fi IP changes don't break auth/API calls.
 */
function getApiBaseFromExpoHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  if (!hostUri) return null;

  // hostUri examples: "10.213.80.19:8081", "192.168.1.5:8081"
  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;

  return `http://${host}:${API_PORT}`;
}

/**
 * Resolved API base URL for mobile → web Hono server.
 * Priority: Expo Metro host (dev) → app.config extra → EXPO_PUBLIC_API_URL → localhost.
 */
export function getApiBase(): string {
  const fromExpo = getApiBaseFromExpoHost();
  if (fromExpo) return fromExpo;

  const fromConfig =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.replace(/\/$/, "") ||
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

  return fromConfig || `http://localhost:${API_PORT}`;
}
