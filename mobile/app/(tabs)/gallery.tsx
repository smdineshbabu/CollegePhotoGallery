import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { useState } from "react";

type Photo = {
  id: string;
  title: string;
  image: string;
};

const INITIAL_PHOTOS: Photo[] = [
  {
    id: "1",
    title: "College Fest",
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1",
  },
  {
    id: "2",
    title: "Annual Day",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
  },
  {
    id: "3",
    title: "Graduation Day",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",
  },
];

export default function GalleryScreen() {
  const [photos, setPhotos] = useState<Photo[]>(INITIAL_PHOTOS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const deletePhoto = (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: () => {
          setPhotos((prev) => prev.filter((p) => p.id !== id));
        },
      },
    ]);
  };

  const startEdit = (photo: Photo) => {
    setEditingId(photo.id);
    setNewTitle(photo.title);
  };

  const saveEdit = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, title: newTitle } : p
      )
    );
    setEditingId(null);
    setNewTitle("");
  };

  const renderItem = ({ item }: { item: Photo }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />

      {editingId === item.id ? (
        <>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            style={styles.input}
          />
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => saveEdit(item.id)}
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => startEdit(item)}
            >
              <Text style={styles.btnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deletePhoto(item.id)}
            >
              <Text style={styles.btnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Gallery</Text>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No photos available</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    marginBottom: 20,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 180,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    padding: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
  },
  editBtn: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 6,
  },
  deleteBtn: {
    backgroundColor: "#FF3B30",
    padding: 10,
    borderRadius: 6,
  },
  saveBtn: {
    backgroundColor: "#34C759",
    padding: 10,
    margin: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#fff",
    margin: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#888",
  },
});
