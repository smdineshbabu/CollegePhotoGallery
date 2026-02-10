import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import api from "../services/api";
import Loader from "../components/Loader";

export default function AdminGallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = async () => {
    try {
      const response = await api.get("/photos");
      setPhotos(response.data);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to load uploaded files"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const renderItem = ({ item }) => {
    const isImage =
      item.filename.endsWith(".jpg") ||
      item.filename.endsWith(".jpeg") ||
      item.filename.endsWith(".png");

    return (
      <View style={styles.card}>
        {isImage ? (
          <Image
            source={{
              uri: `http://192.168.1.5:5000/${item.path}`,
            }}
            style={styles.image}
          />
        ) : (
          <Text style={styles.pdf}>📄 PDF File</Text>
        )}

        <Text style={styles.text}>
          Uploaded by: {item.uploadedBy?.name}
        </Text>
        <Text style={styles.role}>
          Role: {item.uploaderRole}
        </Text>
      </View>
    );
  };

  if (loading) return <Loader />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Admin Gallery
      </Text>

      <FlatList
        data={photos}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#fff",
    marginBottom: 15,
    padding: 10,
    borderRadius: 8,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 6,
  },
  pdf: {
    fontSize: 18,
    textAlign: "center",
    padding: 40,
    backgroundColor: "#eee",
  },
  text: {
    marginTop: 8,
    fontSize: 14,
  },
  role: {
    fontSize: 13,
    color: "gray",
  },
});
