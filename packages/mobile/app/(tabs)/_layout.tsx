import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";
import {
  SquaresFourIcon,
  FlameIcon,
  BookmarkSimpleIcon,
  GearIcon,
} from "phosphor-react-native";

function TabIcon({ icon: Icon, focused }: { icon: any; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Icon size={24} color={focused ? colors.accent : colors.textTertiary} weight={focused ? "fill" : "regular"} />
      {focused && <View style={styles.dot} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
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

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  iconWrap: { alignItems: "center", gap: 4 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
