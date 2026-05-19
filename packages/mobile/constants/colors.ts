/**
 * @deprecated Use `useTheme()` from `../theme` instead.
 * Legacy aliases for gradual migration — maps to Expensify dark theme semantics.
 */
import { darkTheme } from "../theme/themes";
import { colors as palette } from "../theme/colors";

export const colors = {
  background: darkTheme.appBG,
  surface: darkTheme.cardBG,
  surfaceElevated: darkTheme.highlightBG,
  border: darkTheme.border,
  accent: darkTheme.success,
  accentDim: palette.green600,
  green600: palette.green600,
  green700: palette.green700,
  textPrimary: darkTheme.text,
  textSecondary: darkTheme.textSupporting,
  textTertiary: darkTheme.placeholderText,
  success: darkTheme.success,
  warning: darkTheme.warning,
  danger: darkTheme.danger,
  twitter: "#1D9BF0",
  reddit: "#FF4500",
  instagram: "#E1306C",
  youtube: "#FF0000",
  news: "#6366F1",
} as const;
