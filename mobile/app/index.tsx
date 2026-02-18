import { Redirect, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import * as authService from "../services/authService";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const [isChecked, setIsChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Artificial delay for splash screen feel (optional, can be removed for speed)
    // await new Promise(resolve => setTimeout(resolve, 800));
    try {
      const isAuth = await authService.isAuthenticated();
      setIsAuthenticated(isAuth);
    } catch (err) {
      setIsAuthenticated(false);
    } finally {
      setIsChecked(true);
    }
  };

  if (!isChecked) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/(tabs)/home" : "/login"} />;
}
