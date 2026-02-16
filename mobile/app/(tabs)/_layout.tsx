import { Tabs } from "expo-router";
import { Text, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 1,
          borderTopColor: "#e0e0e0",
          elevation: 8,
          height: 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 12,
          backgroundColor: "#ffffff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarBackground: undefined,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Image
              source={{ uri: `https://img.icons8.com/fluency/48/home.png` }}
              style={{ width: 26, height: 26, opacity: color === "#8E8E93" ? 0.5 : 1 }}
            />
          )
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: "Gallery",
          tabBarIcon: ({ color }) => (
            <Image
              source={{ uri: `https://img.icons8.com/fluency/48/stack-of-photos.png` }}
              style={{ width: 26, height: 26, opacity: color === "#8E8E93" ? 0.5 : 1 }}
            />
          )
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Upload",
          tabBarIcon: ({ color }) => (
            <Image
              source={{ uri: `https://img.icons8.com/fluency/48/cloud-lighting.png` }}
              style={{ width: 26, height: 26, opacity: color === "#8E8E93" ? 0.5 : 1 }}
            />
          )
        }}
      />
    </Tabs>
  );
}
