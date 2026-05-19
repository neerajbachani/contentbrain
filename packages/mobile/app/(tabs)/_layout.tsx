import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useMemo } from "react";
import {
  SquaresFourIcon,
  FlameIcon,
  BookmarkSimpleIcon,
  GearIcon,
} from "phosphor-react-native";
import { useTheme } from "../../theme";
import { variables } from "../../theme/variables";

function TabIcon({ icon: Icon, focused }: { icon: typeof SquaresFourIcon; focused: boolean }) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        iconWrap: { alignItems: "center", gap: 4 },
        dot: {
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.success,
        },
      }),
    [theme.success]
  );

  return (
    <View style={styles.iconWrap}>
      <Icon
        size={24}
        color={focused ? theme.iconMenu : theme.icon}
        weight={focused ? "fill" : "regular"}
      />
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        tabBar: {
          backgroundColor: theme.sidebar,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: variables.bottomTabHeight,
          paddingBottom: variables.spacing2,
          paddingTop: variables.spacing2,
        },
      }),
    [theme]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.iconMenu,
        tabBarInactiveTintColor: theme.icon,
      }}
    >
      <Tabs.Screen
        name="canvas"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={SquaresFourIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trending"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={FlameIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={BookmarkSimpleIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={GearIcon} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
