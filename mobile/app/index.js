import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        College Photo Gallery
      </Text>

      <Button
        title="Upload Photo"
        onPress={() => router.push("/upload")}
      />

      <View style={{ height: 15 }} />

      <Button
        title="Admin Gallery"
        onPress={() => router.push("/adminGallery")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
  },
});
