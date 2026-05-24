import { ReactNode, useRef } from "react";
import { View, Text, StyleSheet, Animated, PanResponder } from "react-native";
import { SparkleIcon, TrashIcon } from "phosphor-react-native";
import { useTheme, useThemedStyles } from "../../theme";
import type { ThemeColors } from "../../theme/types";

const SWIPE_THRESHOLD = 72;

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { overflow: "hidden", borderRadius: 16 },
    row: { flexDirection: "row", alignItems: "stretch" },
    actionsLeft: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 80,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.success,
      borderRadius: 16,
    },
    actionsRight: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 80,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.danger,
      borderRadius: 16,
    },
    actionText: { color: theme.appBG, fontSize: 11, fontWeight: "700", marginTop: 4 },
    card: { flex: 1 },
  });
}

type Props = {
  children: ReactNode;
  onDelete: () => void;
  onQuickRemix: () => void;
  enabled?: boolean;
  compact?: boolean;
};

export default function SwipeableCard({ children, onDelete, onQuickRemix, enabled = true, compact = false }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const translateX = useRef(new Animated.Value(0)).current;

  if (!enabled) return <>{children}</>;

  const reset = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 8,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          reset();
          onQuickRemix();
          return;
        }
        if (gesture.dx < -SWIPE_THRESHOLD) {
          reset();
          onDelete();
          return;
        }
        reset();
      },
      onPanResponderTerminate: reset,
    })
  ).current;

  return (
    <View style={[styles.wrap, { marginBottom: compact ? 8 : 12 }]}>
      <View style={styles.actionsLeft}>
        <SparkleIcon size={22} color={theme.appBG} weight="fill" />
        <Text style={styles.actionText}>Remix</Text>
      </View>
      <View style={styles.actionsRight}>
        <TrashIcon size={22} color={theme.appBG} />
        <Text style={styles.actionText}>Delete</Text>
      </View>
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.card}>{children}</View>
      </Animated.View>
    </View>
  );
}
