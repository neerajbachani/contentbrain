import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";
import { typography } from "../../theme/fonts";
import { Text } from "./Text";

type ButtonSize = "extraSmall" | "small" | "default" | "medium" | "large";
type ButtonVariant = "default" | "success" | "danger" | "link";

type Props = Omit<PressableProps, "style"> & {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  extraSmall: {
    container: {
      minHeight: variables.componentSizeXSmall,
      minWidth: variables.componentSizeXSmall,
      paddingHorizontal: 8,
    },
    text: { fontSize: variables.fontSizeExtraSmall },
  },
  small: {
    container: {
      minHeight: variables.componentSizeSmall,
      minWidth: variables.componentSizeSmall,
      paddingHorizontal: 12,
    },
    text: { fontSize: variables.fontSizeSmall },
  },
  default: {
    container: {
      minHeight: variables.componentSizeNormal,
      paddingHorizontal: variables.spacing4,
    },
    text: { fontSize: variables.fontSizeNormal },
  },
  medium: {
    container: {
      minHeight: variables.componentSizeNormal,
      minWidth: variables.componentSizeNormal,
      paddingHorizontal: variables.spacing4,
    },
    text: { fontSize: variables.fontSizeLabel },
  },
  large: {
    container: {
      minHeight: variables.componentSizeLarge,
      minWidth: variables.componentSizeLarge,
      paddingHorizontal: variables.spacing5,
    },
    text: { fontSize: variables.fontSizeNormal },
  },
};

export function Button({
  children,
  variant = "default",
  size = "default",
  isLoading = false,
  isDisabled = false,
  style,
  textStyle,
  onPress,
  ...props
}: Props) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const disabled = isDisabled || isLoading;

  const colors = useMemo(() => {
    if (variant === "success") {
      return {
        bg: pressed ? theme.successPressed : theme.success,
        text: theme.buttonSuccessText,
      };
    }
    if (variant === "danger") {
      return {
        bg: pressed ? theme.dangerHover : theme.danger,
        text: theme.buttonSuccessText,
      };
    }
    if (variant === "link") {
      return {
        bg: theme.transparent,
        text: theme.link,
      };
    }
    return {
      bg: pressed ? theme.buttonPressedBG : theme.buttonDefaultBG,
      text: theme.text,
    };
  }, [pressed, theme, variant]);

  const containerStyle: ViewStyle = {
    backgroundColor: colors.bg,
    borderRadius: variables.buttonBorderRadius,
    justifyContent: "center",
    alignItems: "center",
    opacity: disabled ? 0.5 : 1,
    ...sizeStyles[size].container,
    ...(variant === "link" ? { minHeight: undefined, paddingHorizontal: 0 } : {}),
  };

  async function handlePress(e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={({ pressed: isPressed }) => [
        containerStyle,
        isPressed && variant === "default" ? { backgroundColor: theme.buttonHoveredBG } : null,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Text
          family="bold"
          color={colors.text}
          style={[typography.button, sizeStyles[size].text, textStyle]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
