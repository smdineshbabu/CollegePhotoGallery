import { View, Text, Button, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile } from "../services/uploadService";
import { useState } from "react";
import Loader from "../components/Loader";

export default function UploadScreen() {
  const [loading, setLoading] = useState(false);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
    });

    if (result.canceled) return;

    try {
      setLoading(true);
      const response = await uploadFile(result.assets[0]);
      Alert.alert("Success", response.message);
    } catch (error) {
      Alert.alert("Error", "File upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Upload Image or PDF</Text>
      <Button title="Pick File" onPress={pickFile} />
    </View>
  );
}
