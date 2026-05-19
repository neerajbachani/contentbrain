import React from "react";
import { View, type ViewProps, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";

type Props = ViewProps & {
  style?: StyleProp<ViewStyle>;
};

export function Card({ style, children, ...props }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBG,
          borderColor: theme.cardBorder,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: variables.componentBorderRadiusCard,
    borderWidth: 1,
    padding: variables.spacing4,
  },
});
