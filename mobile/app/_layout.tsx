import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 400,
        gestureEnabled: true,
        contentStyle: { backgroundColor: '#fff' }
      }}
    />
  );
}
