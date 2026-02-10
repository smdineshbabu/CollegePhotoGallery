import React, { useState } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  StyleSheet,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "../services/uploadService";
import Loader from "../components/Loader";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    try {
      const result =
        await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
        });

      if (result.canceled) return;

      setFile(result.assets[0]);
    } catch (error) {
      Alert.alert("Error", "File selection failed");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      Alert.alert(
        "No file",
        "Please select an image or PDF"
      );
      return;
    }

    try {
      setLoading(true);
      await uploadFile(file);
      Alert.alert("Success", "File uploaded");
      setFile(null);
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload File</Text>

      <Button title="Select File" onPress={pickFile} />

      {file && (
        <Text style={styles.file}>
          Selected: {file.name}
        </Text>
      )}

      <View style={styles.space} />

      <Button
        title="Upload"
        onPress={handleUpload}
      />

      {loading && <Loader />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  file: {
    marginTop: 15,
    textAlign: "center",
    color: "green",
  },
  space: {
    height: 15,
  },
});
