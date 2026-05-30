import { BlurView } from "expo-blur";
import { BookOpen, Clock, Settings } from "lucide-react-native";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { useTheme } from "@/theme/useTheme";

export default function AppTabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: {
          fontFamily: theme.fontFamilies.bodyMedium,
        },
        tabBarBackground: () => (
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="light" />
        ),
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "rgba(251, 249, 245, 0.85)",
    borderTopWidth: 0,
  },
});
