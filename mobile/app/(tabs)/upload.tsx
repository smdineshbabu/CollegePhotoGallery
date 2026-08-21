import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useState, useEffect } from "react";
import api from "../../services/api";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as authService from "../../services/authService";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring, withSequence, LinearTransition } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";


const LOGO_PHOTO = "https://img.icons8.com/fluency/96/cloud-lighting.png";
const PICKER_ICON = "https://img.icons8.com/fluency/144/camera.png";

export default function UploadScreen() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("College Events");
  const [customCategory, setCustomCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    };
    fetchUser();
  }, []);

  const categories = ["College Events", "Placements", "Sports", "Campus Life", "Other"];

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to share photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!image) {
      Alert.alert("Error", "Please select an image first");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title for this memory");
      return;
    }

    const finalCategory = category === "Other" ? customCategory : category;
    if (category === "Other" && !customCategory.trim()) {
      Alert.alert("Error", "Please specify your custom category");
      return;
    }

    const formData = new FormData();

    if (Platform.OS === "web") {
      const response = await fetch(image);
      const blob = await response.blob();
      formData.append("photos", blob, `upload_${Date.now()}.jpg`);
    } else {
      formData.append("photos", {
        uri: image,
        name: `upload_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
    }
    formData.append("title", title);
    formData.append("folder", finalCategory);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setUploading(true);
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Track uploaded photo IDs locally
      const uploadedPhotos = response.data; // Array of Photo objects
      if (Array.isArray(uploadedPhotos)) {
        const stored = await AsyncStorage.getItem("my_uploads");
        const myUploads = stored ? JSON.parse(stored) : [];
        const newIds = uploadedPhotos.map(p => p._id);
        await AsyncStorage.setItem("my_uploads", JSON.stringify([...myUploads, ...newIds]));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Memory shared! 🛡️ It is now awaiting admin approval before appearing in the gallery.", [
        {
          text: "Go to Gallery", onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(tabs)/gallery");
          }
        },
        { text: "OK" },
      ]);

      setImage(null);
      setTitle("");
      setCategory("College Events");
      setCustomCategory("");
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload. Check your connection.");
    } finally {
      setUploading(false);
    }
  };

  const AnimatedScale = ({ children, onPress, style, disabled }: any) => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
      if (!disabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
          withSpring(0.92, { damping: 4, stiffness: 300 }),
          withSpring(1, { damping: 4, stiffness: 200 })
        );
        onPress?.();
      }
    };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={disabled}
      >
        <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.9)' }]} />
          <LinearGradient
            colors={["#007AFF", "#00C6FF"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.headerContent}>
            <Image source={{ uri: LOGO_PHOTO }} style={styles.headerLogo} contentFit="contain" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle}>New Post</Text>
              <Text style={styles.headerSubtitle}>Share a college memory</Text>
            </View>
            <Text style={styles.sparkles}>✨</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.previewContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={pickImage}
            style={StyleSheet.absoluteFill}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={styles.previewImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.emptyImageContainer}>
                <LinearGradient
                  colors={["#E6F2FF", "#FFFFFF"]}
                  style={styles.pickerGlow}
                >
                  <Image source={{ uri: PICKER_ICON }} style={styles.largePickerIcon} contentFit="contain" />
                </LinearGradient>
                <Text style={styles.pickText}>TAP TO CHOSE MEMORY</Text>
                <Text style={styles.pickSubtext}>High-quality photos preferred</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.form}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What's happening in this photo?"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat, index) => (
              <AnimatedScale
                key={cat}
                style={[
                  styles.categoryChip,
                  category === cat && styles.categoryChipSelected,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </AnimatedScale>
            ))}
          </View>

          {category === "Other" && (
            <Animated.View layout={LinearTransition.springify()}>
              <TextInput
                style={[styles.input, { marginTop: -10 }]}
                placeholder="e.g., Canteen, Library"
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholderTextColor="#999"
              />
            </Animated.View>
          )}

          <AnimatedScale
            style={[styles.uploadBtn, uploading && styles.disabledBtn]}
            onPress={handleUpload}
            disabled={uploading}
          >
            <LinearGradient
              colors={["#007AFF", "#0052D4"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadBtnText}>Share to Gallery</Text>
            )}
          </AnimatedScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding to avoid tab bar overlap
  },
  header: {
    paddingTop: 65,
    paddingHorizontal: 25,
    paddingBottom: 25,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1A1A1A",
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  smallPicker: {
    flex: 1,
    height: 100,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E6F2FF',
  },
  pickerIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
    width: "100%",
  },
  headerLogo: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 2,
  },
  sparkles: {
    fontSize: 24,
  },
  previewContainer: {
    width: "90%",
    height: 250,
    backgroundColor: "#F8F9FA",
    alignSelf: "center",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#EFEFEF",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 30,
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  pdfPreview: {
    alignItems: 'center',
  },
  pdfName: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  emptyImageContainer: {
    alignItems: "center",
  },
  largePickerIcon: {
    width: 85,
    height: 85,
    marginBottom: 5,
  },
  pickerGlow: {
    padding: 40,
    borderRadius: 85,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 15,
  },
  pickText: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "900",
    letterSpacing: 1,
  },
  pickSubtext: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "600",
    marginTop: 4,
  },
  restrictedBanner: {
    backgroundColor: '#FFF5F5',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FED7D7',
    marginTop: 20,
  },
  restrictedText: {
    color: '#C53030',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  form: {
    paddingHorizontal: 25,
    marginTop: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    color: "#1A1A1A",
    marginBottom: 20,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 30, // Increased spacing before button
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#EFEFEF",
    borderRadius: 25,
    marginRight: 10,
    marginBottom: 10,
  },
  categoryChipSelected: {
    backgroundColor: "#007AFF",
  },
  categoryText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  categoryTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  uploadBtn: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 20,
    overflow: "hidden",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
