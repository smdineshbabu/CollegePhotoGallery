import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import api from "../services/api";

const GalleryScreen = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const res = await api.get("/photos");
      setPhotos(res.data);
    } catch (error) {
      console.log("Error fetching photos", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get("/photos");
      setPhotos(res.data);
    } catch (error) {
      console.log("Refresh error", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
      <Text style={styles.title}>{item.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading gallery...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
    />
  );
};

export default GalleryScreen;

const styles = StyleSheet.create({
  list: {
    padding: 10,
  },
  card: {
    flex: 1,
    margin: 5,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 3,
    padding: 5,
  },
  image: {
    height: 120,
    borderRadius: 6,
  },
  title: {
    marginTop: 5,
    fontSize: 14,
    textAlign: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
