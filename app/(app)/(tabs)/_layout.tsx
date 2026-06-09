import { BlurView } from "expo-blur";
import { BookOpen, Clock, Settings } from "lucide-react-native";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";

import { useTheme } from "@/theme/useTheme";

export default function AppTabsLayout() {
  const theme = useTheme();
  const blurTint = theme.mode === "dark" ? "dark" : "light";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          // Use the theme's `surface` slot. The 0.85 alpha lets the BlurView
          // tint show through; the visible color is roughly `surface` mixed
          // with the underlying screen content.
          backgroundColor: `${theme.colors.surface}D9`,
          borderTopWidth: 0,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamilies.bodyMedium,
        },
        tabBarBackground: () => (
          <BlurView intensity={80} style={StyleSheet.absoluteFill} tint={blurTint} />
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
