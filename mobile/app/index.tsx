import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import CustomButton from "../components/CustomButton";
import { login } from "../services/authService";

// This tells TypeScript exactly what to expect from the login function
interface LoginResponse {
  user: {
    role: "student" | "mentor" | "admin";
  };
  token: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      // We "cast" the response so TypeScript stops complaining about the role
      const res = (await login(email, password)) as LoginResponse;

      if (res.user.role === "student") {
        router.replace("/studentHome" as any);
      } else if (res.user.role === "mentor") {
        router.replace("/mentorHome" as any);
      } else if (res.user.role === "admin") {
        router.replace("/adminHome" as any);
      }
    } catch (error: any) {
      Alert.alert("Login failed", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>College Photo Gallery</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <CustomButton
        title={loading ? "Logging in..." : "Login"}
        onPress={handleLogin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 12, marginBottom: 15 },
});