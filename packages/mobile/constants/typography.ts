import { TextStyle } from "react-native";

export const typography: Record<string, TextStyle> = {
  displayLarge: { fontSize: 32, fontWeight: "700", letterSpacing: -0.5 },
  displayMedium: { fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: "600" },
  subheading: { fontSize: 15, fontWeight: "500" },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: "400" },
  mono: { fontSize: 13, letterSpacing: 0.2 },
};
