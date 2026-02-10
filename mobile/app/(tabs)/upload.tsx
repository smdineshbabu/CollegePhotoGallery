import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

export default function UploadScreen() {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImage = () => {
    if (!image) {
      Alert.alert("No image selected");
      return;
    }

    Alert.alert("Success", "Image ready for upload (backend next)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upload Photo</Text>

      <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
        <Text style={styles.btnText}>Pick Image</Text>
      </TouchableOpacity>

      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}

      <TouchableOpacity style={styles.uploadBtn} onPress={uploadImage}>
        <Text style={styles.btnText}>Upload</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  pickBtn: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  uploadBtn: {
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginTop: 10,
  },
});
