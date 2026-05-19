import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme } from "./themes";
import type { ColorScheme, ThemeColors } from "./types";

type ThemePreference = ColorScheme | "system";

type ThemeContextValue = {
  theme: ThemeColors;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("dark");

  const resolvedScheme: ColorScheme =
    preference === "system"
      ? systemScheme === "light"
        ? "light"
        : "dark"
      : preference;

  const theme = resolvedScheme === "light" ? lightTheme : darkTheme;

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      isDark: resolvedScheme === "dark",
    }),
    [theme, preference, resolvedScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx.theme;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}

export function useThemeStyles<T>(factory: (theme: ThemeColors) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
