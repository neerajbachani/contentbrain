import React, { useMemo } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { getFontFamily, typography, type FontFamilyKey } from "../../theme/fonts";
import { useTheme } from "../../theme";

export type TextPreset = "headline" | "headlineH1" | "headlineH2" | "body" | "label" | "supporting";

type Props = RNTextProps & {
  color?: string;
  fontSize?: number;
  family?: FontFamilyKey;
  preset?: TextPreset;
};

const presetStyles: Record<TextPreset, TextStyle> = {
  headline: typography.headline,
  headlineH1: typography.headlineH1,
  headlineH2: typography.headlineH2,
  body: typography.body,
  label: typography.label,
  supporting: typography.supporting,
};

export function Text({
  color,
  fontSize,
  family = "regular",
  preset,
  style,
  children,
  ...props
}: Props) {
  const theme = useTheme();

  const componentStyle = useMemo(() => {
    const base: TextStyle = preset
      ? { ...presetStyles[preset], color: color ?? theme.heading }
      : {
          ...getFontFamily(family),
          fontSize: fontSize ?? typography.body.fontSize,
          color: color ?? theme.text,
        };
    return [base, style];
  }, [color, family, fontSize, preset, style, theme.heading, theme.text]);

  return (
    <RNText allowFontScaling={false} style={componentStyle} {...props}>
      {children}
    </RNText>
  );
}
