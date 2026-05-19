import { variables } from "./variables";

export const fontFamily = {
  regular: "ExpensifyNeue-Regular",
  bold: "ExpensifyNeue-Bold",
  italic: "ExpensifyNeue-Italic",
  boldItalic: "ExpensifyNeue-BoldItalic",
} as const;

export type FontFamilyKey = keyof typeof fontFamily;

export function getFontFamily(key: FontFamilyKey = "regular") {
  return { fontFamily: fontFamily[key] };
}

export const typography = {
  displayLarge: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeXXXLarge,
    lineHeight: variables.lineHeightXXXLarge,
  },
  headline: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeXLarge,
    lineHeight: variables.lineHeightXXXLarge,
  },
  headlineH1: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeH1,
    lineHeight: variables.lineHeightSizeH2,
  },
  headlineH2: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeH2,
    lineHeight: variables.lineHeightSizeH2,
  },
  body: {
    ...getFontFamily("regular"),
    fontSize: variables.fontSizeNormal,
    lineHeight: variables.fontSizeNormalHeight,
  },
  label: {
    ...getFontFamily("regular"),
    fontSize: variables.fontSizeLabel,
    lineHeight: variables.fontSizeNormalHeight,
  },
  supporting: {
    ...getFontFamily("regular"),
    fontSize: variables.fontSizeSmall,
    lineHeight: variables.fontSizeNormalHeight,
  },
  button: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeNormal,
    textAlign: "center" as const,
    paddingBottom: 1,
  },
  /** @deprecated use headline */
  displayMedium: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeXLarge,
    lineHeight: variables.lineHeightXXXLarge,
  },
  /** @deprecated use headlineH2 */
  subheading: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeH2,
    lineHeight: variables.lineHeightSizeH2,
  },
  /** @deprecated use supporting */
  caption: {
    ...getFontFamily("regular"),
    fontSize: variables.fontSizeSmall,
    lineHeight: variables.fontSizeNormalHeight,
  },
  /** @deprecated use headline */
  heading: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeXLarge,
    lineHeight: variables.lineHeightXXXLarge,
  },
  /** @deprecated use headlineH2 */
  heading3: {
    ...getFontFamily("bold"),
    fontSize: variables.fontSizeH2,
    lineHeight: variables.lineHeightSizeH2,
  },
} as const;
