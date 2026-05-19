import React from "react";
import {
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";
import { getFontFamily } from "../../theme/fonts";

type Props = RNTextInputProps & {
  containerStyle?: StyleProp<TextStyle>;
};

export function TextInput({ style, containerStyle, ...props }: Props) {
  const theme = useTheme();

  return (
    <RNTextInput
      allowFontScaling={false}
      placeholderTextColor={theme.placeholderText}
      style={[
        styles.input,
        {
          backgroundColor: theme.highlightBG,
          borderColor: theme.border,
          color: theme.text,
        },
        style,
        containerStyle,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...getFontFamily("regular"),
    height: variables.inputComponentSizeNormal,
    borderWidth: 1,
    borderRadius: variables.componentBorderRadius,
    paddingHorizontal: variables.spacing3,
    fontSize: variables.fontSizeNormal,
  },
});
