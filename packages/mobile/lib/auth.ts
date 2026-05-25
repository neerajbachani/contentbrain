import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getApiBase } from "./apiBase";

const isWeb = Platform.OS === "web";
const TOKEN_KEY = "bearer_token";

const baseURL = getApiBase();

export function getToken(): string {
  try {
    return SecureStore.getItem(TOKEN_KEY) ?? "";
  } catch {
    try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; }
  }
}

/** Bearer Authorization value for Hono /api routes (Better Auth expects this format). */
export function getBearerAuthorization(): string {
  const token = getToken().trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

/** Headers for authenticated API requests from the mobile app. */
export function getApiAuthHeaders(): Record<string, string> {
  const authorization = getBearerAuthorization();
  return {
    ...(authorization ? { Authorization: authorization } : {}),
    ...(isWeb ? {} : { "expo-origin": "mobile://" }),
  };
}

export function sessionCheckQueryKey(apiBase: string) {
  return ["session-check", apiBase] as const;
}

export function setToken(token: string) {
  try {
    SecureStore.setItem(TOKEN_KEY, token);
  } catch {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
  }
}

export async function removeToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
}

export const authClient = createAuthClient({
  baseURL,
  basePath: "/api/auth",
  fetchOptions: {
    ...(isWeb ? { credentials: "omit" as const } : {}),
    auth: {
      type: "Bearer",
      token: () => getToken(),
    },
    headers: isWeb ? {} : { "expo-origin": "mobile://" },
  },
});

export function captureToken(ctx: { response: Response }) {
  const token = ctx.response.headers.get("set-auth-token");
  if (token) setToken(token.replace(/^Bearer\s+/i, "").trim());
}

export async function clearToken() {
  await removeToken();
}
