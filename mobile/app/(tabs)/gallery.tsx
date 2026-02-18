import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  UIManager,
  ScrollView,
  StatusBar,
  LayoutAnimation,
  BackHandler,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter, usePathname } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import ShimmerLoader from "../../components/ShimmerLoader";
import PhotoViewer from "../../components/PhotoViewer";

import * as authService from "../../services/authService";
import * as authStorage from "../../services/authStorage";
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withSpring, withTiming, LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import * as ImagePicker from "expo-image-picker";
import api from "../../services/api";

const { width } = Dimensions.get("window");
const LOGO_PHOTO = "https://img.icons8.com/fluency/96/stack-of-photos.png";
const COLUMN_COUNT = 2;
const CARD_WIDTH = (width - 40) / COLUMN_COUNT; // 40 = padding

type Photo = {
  _id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string; // High-speed thumbnail
  folder: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  likes?: string[];
  views?: number;
};

export default function GalleryScreen() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [viewerIndex, setViewerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const flatListRef = useRef<FlatList>(null);

  const scrollToTop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };
  const selectedPhotoIdx = useRef<number>(0);
  const sessionViewedIds = useRef<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);

  const fetchUserData = async () => {
    const userData = await authService.getCurrentUser();
    setUser(userData);
  };
  const cameFromHome = useRef(false);
  const isInitialFocus = useRef(true);

  // Folder Navigation State
  const [viewMode, setViewMode] = useState<"folders" | "photos">("folders");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Upload State

  const [isPhotoActionsVisible, setIsPhotoActionsVisible] = useState(false);
  const [selectedPhotoForAction, setSelectedPhotoForAction] = useState<Photo | null>(null);

  // Handle incoming parameters (from Home screen)
  const { folder } = useLocalSearchParams();

  // Dashboard Tracking
  const [myUploadsIds, setMyUploadsIds] = useState<string[]>([]);
  const [seenUploadsCount, setSeenUploadsCount] = useState<number>(0);


  // Upload Logic States 
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [newTitles, setNewTitles] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("College Events");
  const [customCategory, setCustomCategory] = useState("");
  const [uploading, setUploading] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      if (next.size === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  const fetchPhotos = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      await fetchUserData();
      const response = await api.get("/upload");
      console.log("[GALLERY] API Response:", response.data.length, "photos");

      const storedUrl = await authStorage.getServerUrl();
      let baseRaw = (storedUrl || api.defaults.baseURL || "http://10.73.154.112:5000/api");
      if (!baseRaw.startsWith("http")) baseRaw = "http://" + baseRaw;
      const baseApiUrl = baseRaw.replace("/api", "").replace(/\/$/, "");

      const standardizedPhotos = response.data.map((p: any) => {
        let finalImageUrl = p.imageUrl;
        let finalThumbnailUrl = p.thumbnailUrl;

        // Helper to fix URL
        const fixUrl = (url: string) => {
          if (!url) return null;
          // If it's already a relative path (starts with /uploads), just prepend base
          if (url.startsWith("/uploads")) {
            return `${baseApiUrl}${url}`.trim();
          }
          // If it's an absolute URL (http...), strip the domain and use current base
          if (url.startsWith("http")) {
            const parts = url.split("/uploads/");
            if (parts.length > 1) {
              return `${baseApiUrl}/uploads/${parts[1]}`.trim();
            }
          }
          // Fallback
          return url.trim();
        };

        return {
          ...p,
          imageUrl: fixUrl(p.imageUrl) || p.imageUrl,
          thumbnailUrl: fixUrl(p.thumbnailUrl) || p.thumbnailUrl || fixUrl(p.imageUrl), // Fallback to main image if thumb missing
        };
      });
      console.log("[GALLERY] Standardized photos:", standardizedPhotos.length);
      if (standardizedPhotos.length > 0) {
        console.log("[GALLERY] Sample standardized photo:", standardizedPhotos[0]);
      }
      const filteredResult = standardizedPhotos.filter((p: any) => {
        const folder = (p.folder || "").toLowerCase();
        const title = (p.title || "").toLowerCase();
        // Skip anything related to recovered/restored
        const isExcluded = folder.includes("recovered") ||
          folder.includes("restored") ||
          title.includes("recovered") ||
          title.includes("restored");
        return p.imageUrl && !isExcluded;
      });
      setPhotos(filteredResult);
    } catch (error: any) {
      if (showLoading) {
        console.error("[GALLERY] Error fetching photos:", error);
        console.error("[GALLERY] Error message:", error.message);
        Alert.alert(
          "Connection Error",
          `Failed to load gallery.\n\n1.Ensure your phone is on the same hotspot / WiFi.\n2.Check the Server URL in Settings(Gear Icon).\n\nDetail: ${error.message} `
        );
      }
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadMyUploads = async () => {
        try {
          const stored = await AsyncStorage.getItem("my_uploads");
          if (stored) {
            const ids = JSON.parse(stored);
            setMyUploadsIds(ids);

            const seen = await AsyncStorage.getItem("seen_uploads_count");
            if (seen) setSeenUploadsCount(parseInt(seen));
          }
        } catch (e) {
          console.error("Error loading my uploads:", e);
        }
      };

      // Simplify initial load logic
      const loadInitialData = async () => {
        await loadMyUploads(); // RESTORED: Critical for filtering!
        await fetchPhotos(isInitialFocus.current);
        isInitialFocus.current = false;
      };
      loadInitialData();
    }, [])
  );

  // Consolidated Param Handling - SOURCE OF TRUTH
  useEffect(() => {
    if (folder) {
      const decodedFolder = decodeURIComponent(folder as string);
      console.log("[GALLERY] Setting folder from param:", decodedFolder);
      setSelectedFolder(decodedFolder);
      setViewMode("photos");
      cameFromHome.current = true;
    } else {
      // If no param, ensure we are in folder mode (unless we are just navigating back from a photo)
      // We only reset if we are NOT already in a folder state initiated by the user within the tab
      // But to fix the "stuck" issue, we entering the tab without params should probably reset
      if (!cameFromHome.current && !selectedFolder) {
        setViewMode("folders");
      }
    }
  }, [folder]);

  // Cleanup params on unmount/blur is handled by the router automatically in some cases,
  // but let's ensure we don't have lingering params when switching tabs significantly.
  // actually, let's REMOVE the manual param clearing on blur for now to see if it stabilizes navigation.




  const incrementView = async (id: string) => {
    if (!id || sessionViewedIds.current.has(id)) return;
    try {
      sessionViewedIds.current.add(id);
      await api.patch(`/upload/${id}/view`);
    } catch (error) {
      // Log only in dev to keep UI clean
      if (__DEV__) console.log("View update failed:", id);
    }
  };


  const handleDeletePhoto = (photo: Photo) => {
    Alert.alert(
      "Admin Approval Required",
      "Deletions are now handled via admin approval. Would you like to send a deletion request for this photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Deletion",
          onPress: () => {
            // Find index and open viewer
            const idx = filteredPhotos.findIndex(p => p._id === photo._id);
            if (idx !== -1) {
              setViewerIndex(idx);
              setViewerOpen(true);
              // The viewer will naturally show the 'Admin' and 'Delete' buttons
              // and the user can proceed from there.
            }
          }
        }
      ]
    );
  };




  const handlePhotoActions = (item: Photo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Photo Actions",
      "What would you like to do with this memory?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeletePhoto(item) },
      ]
    );
  };


  const MemoizedFolderItem = memo(({ item, onPress, onActions }: { item: any; onPress: (name: string) => void, onActions?: (name: string) => void }) => (
    <TouchableOpacity
      style={styles.folderCard}
      activeOpacity={0.8}
      onPress={() => onPress(item.name)}
      onLongPress={() => onActions?.(item.name)}
    >
      <View style={styles.folderImageContainer}>
        <Image
          source={{
            uri: item.preview,
            headers: { "bypass-tunnel-reminder": "true" }
          }}
          style={styles.folderPreview}
          transition={200}
        />
        <View style={styles.folderIconContainer}>
          <Ionicons name="folder" size={20} color="#fff" />
        </View>
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.folderCount}>{item.count} Photos</Text>
      </View>
    </TouchableOpacity>
  ));

  const MemoizedPhotoItem = memo(({ item, onPress, onActions, onSelect, isSelected, isSelectionMode, index }: {
    item: Photo;
    onPress: (photo: Photo) => void;
    onActions: (photo: Photo) => void;
    onSelect: (photoId: string) => void;
    isSelected: boolean;
    isSelectionMode: boolean;
    index: number;
  }) => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        activeOpacity={0.8}
        onPress={() => {
          if (isSelectionMode) {
            onSelect(item._id);
          } else {
            onPress(item);
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            onSelect(item._id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
            onActions(item);
          }
        }}
      >
        <Image
          source={{
            uri: item.thumbnailUrl || item.imageUrl,
            headers: { "bypass-tunnel-reminder": "true" }
          }}
          style={styles.image}
          transition={300}
          recyclingKey={item._id}
        />

        {/* Status Overlays */}
        {(item.status === 'pending' || item.status === 'rejected') && (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={styles.statusOverlay}>
              <View style={[
                styles.statusBadge,
                item.status === 'rejected' ? styles.statusBadgeRejected : styles.statusBadgePending
              ]}>
                <Ionicons
                  name={item.status === 'rejected' ? "close-circle" : "time"}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.statusBadgeText}>
                  {item.status === 'rejected' ? "Rejected" : "Pending"}
                </Text>
              </View>
            </View>
          </BlurView>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.cardOverlay}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardCategory}>{item.folder || "Event"}</Text>
            {item.likes && item.likes.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="heart" size={10} color="#FF3B30" style={{ marginRight: 2 }} />
                <Text style={[styles.cardCategory, { color: '#fff' }]}>{item.likes.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || "Untitled"}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  ));

  const handleBackToFolders = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Smoother layout transition for folder switching
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

    // If we came from Home (Explore Category), go back to Home directly
    if (cameFromHome.current) {
      setViewMode("folders");
      setSelectedFolder(null);
      cameFromHome.current = false;
      router.replace("/(tabs)/home");
      return;
    }

    // Unified back logic
    if (viewMode === "photos" && selectedFolder) {
      // If in a folder, go back to folders list
      setViewMode("folders");
      setSelectedFolder(null);
      return;
    }

    // Otherwise (in folders or in 'All Photos' grid), go home
    setViewMode("folders");
    setSelectedFolder(null);
    router.replace("/(tabs)/home");
  };



  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    fetchPhotos(true).finally(() => setRefreshing(false));
  }, []);

  // Handle hardware back button with focus safety
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (viewMode === "photos") {
          handleBackToFolders();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        backAction
      );

      return () => {
        backHandler.remove();
        // Aggressively clear params when leaving context
        router.setParams({ folder: undefined, openMyUploads: undefined });
      };
    }, [viewMode])
  );

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const currentItem = viewableItems[0].item;
      incrementView(currentItem._id);
    }
  }, []);

  // Group photos into folders
  const getFolders = () => {
    const folderMap: { [key: string]: { name: string; count: number; preview: string } } = {};
    // Only count approved photos for the main folders view
    const approvedPhotos = photos.filter(p => p.status === 'approved');

    approvedPhotos.forEach((photo) => {
      const folderName = photo.folder || "General";
      if (!folderMap[folderName]) {
        folderMap[folderName] = {
          name: folderName,
          count: 0,
          preview: photo.imageUrl,
        };
      }
      folderMap[folderName].count++;
    });
    return Object.values(folderMap)
      .filter(f => f.name !== "Restored")
      .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to upload photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uris = result.assets.map(asset => asset.uri);
      setPreviewImages(uris);
      setNewTitles(uris.map(() => ""));

      // Smart folder pre-selection
      const standardCategories = ["College Events", "Placements", "Sports", "Campus Life"];
      if (selectedFolder && standardCategories.includes(selectedFolder)) {
        setNewCategory(selectedFolder);
        setCustomCategory("");
      } else if (selectedFolder && selectedFolder !== "Restored") {
        setNewCategory("Other");
        setCustomCategory(selectedFolder);
      } else {
        setNewCategory("College Events");
        setCustomCategory("");
      }

      setIsUploadModalVisible(true);
    }
  };

  const uploadImage = async () => {
    if (previewImages.length === 0) return;

    // Check if at least the first title is provided if multiple, or all if preferred
    if (newTitles.some(t => !t.trim())) {
      Alert.alert("Error", "Please provide a title for all selected photos");
      return;
    }

    const finalCategory = newCategory === "Other" ? customCategory : newCategory;

    if (newCategory === "Other" && !customCategory.trim()) {
      Alert.alert("Error", "Please specify the category");
      return;
    }

    const formData = new FormData();

    if (Platform.OS === "web") {
      for (let i = 0; i < previewImages.length; i++) {
        const uri = previewImages[i];
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append("photos", blob, `upload_${i}_${Date.now()}.jpg`);
      }
    } else {
      previewImages.forEach((uri, index) => {
        formData.append("photos", {
          uri: uri,
          name: `upload_${index}_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);
      });
    }

    formData.append("titles", JSON.stringify(newTitles));
    formData.append("folder", finalCategory);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setUploading(true);
      const response = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // TRACK UPLOAD IDs
      try {
        const newPhotos = response.data;
        if (Array.isArray(newPhotos)) {
          const newIds = newPhotos.map(p => p._id);
          const stored = await AsyncStorage.getItem("my_uploads");
          let currentIds = stored ? JSON.parse(stored) : [];
          // Ensure uniqueness and append new ones
          const updatedIds = Array.from(new Set([...currentIds, ...newIds]));
          await AsyncStorage.setItem("my_uploads", JSON.stringify(updatedIds));
          setMyUploadsIds(updatedIds);
          console.log("[UPLOAD] Tracked IDs saved:", newIds.length);
        }
      } catch (trackErr) {
        console.error("Failed to track upload IDs:", trackErr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsUploadModalVisible(false);
      setCustomCategory("");
      Alert.alert("Success", `${previewImages.length} memories added to gallery!`, [{ text: "Awesome" }]);
      fetchPhotos();
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload images. Server might be down.");
    } finally {
      setUploading(false);
      setPreviewImages([]);
      setNewTitles([]);
    }
  };



  const handleBulkMove = () => {
    if (selectedIds.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      "Bulk Move",
      `Move ${selectedIds.size} items to which folder?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "College Events",
          onPress: () => performBulkMove("College Events")
        },
        {
          text: "Campus Life",
          onPress: () => performBulkMove("Campus Life")
        },
        {
          text: "Placements",
          onPress: () => performBulkMove("Placements")
        }
      ]
    );
  };

  const performBulkMove = async (folderName: string) => {
    try {
      setLoading(true);
      const ids = Array.from(selectedIds);
      await api.patch("/upload/bulk-move", { ids, folder: folderName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Moved ${ids.length} items to ${folderName}`);
      clearSelection();
      fetchPhotos();
    } catch (err) {
      Alert.alert("Error", "Bulk move failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteRequest = () => {
    if (selectedIds.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    Alert.alert(
      "Bulk Delete Request",
      `Are you sure you want to request deletion of ${selectedIds.size} items?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Request",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const ids = Array.from(selectedIds);
              await api.post("/requests/bulk-delete", {
                photoIds: ids,
                message: `Bulk deletion request for ${ids.length} photos.`
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Request Sent", "Admin will review your deletion request.");
              clearSelection();
              fetchPhotos();
            } catch (err) {
              Alert.alert("Error", "Batch request failed");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderFolderItem = useCallback(({ item }: { item: any }) => (
    <MemoizedFolderItem
      item={item}
      onPress={(name) => {
        Haptics.selectionAsync();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedFolder(name);
        setViewMode("photos");
      }}
    />
  ), []);

  const filteredPhotos = photos.filter(p => {
    if (p.status !== 'approved') return false;

    const pFolder = (p.folder || "General").trim().toLowerCase();
    const sFolder = (selectedFolder || "").trim().toLowerCase();
    const matchesFolder = !selectedFolder || pFolder === sFolder;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const renderPhotoItem = useCallback(({ item, index }: { item: Photo, index: number }) => (
    <MemoizedPhotoItem
      item={item}
      index={index}
      isSelected={selectedIds.has(item._id)}
      isSelectionMode={isSelectionMode}
      onSelect={toggleSelection}
      onPress={(photo) => {
        Haptics.selectionAsync();
        const photoIdx = filteredPhotos.findIndex(p => p._id === photo._id);
        setViewerIndex(photoIdx >= 0 ? photoIdx : 0);
        setViewerOpen(true);
        incrementView(photo._id);
      }}
      onActions={handlePhotoActions}
    />
  ), [filteredPhotos, user, handlePhotoActions, selectedIds, isSelectionMode, toggleSelection]);

  if (loading) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={scrollToTop}
          style={styles.header}
        >
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["#007AFF", "#00C6FF"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>{viewMode === "folders" ? "Gallery" : selectedFolder}</Text>
              <Text style={styles.headerSubtitle}>
                {viewMode === "folders" ? "Tap a folder to browse" : `${filteredPhotos.length} memories found`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/requests")}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search memories..."
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.listContent}>
          <View style={styles.columnWrapper}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ShimmerLoader
                key={i}
                width={CARD_WIDTH}
                height={CARD_WIDTH * 1.2}
                borderRadius={20}
                style={{ marginBottom: 20 }}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }


  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isSelectionMode ? "light-content" : "dark-content"} />

      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={clearSelection} style={styles.selectionCancelBtn}>
            <Text style={styles.selectionCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionHeaderTitle}>{selectedIds.size} Selected</Text>
          <View style={{ width: 60 }} />
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={scrollToTop}
          style={styles.header}
        >
          <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["#007AFF", "#00C6FF"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.headerTopRow}>
            {viewMode === "photos" ? (
              <TouchableOpacity
                onPress={handleBackToFolders}
                style={styles.backBtn}
              >
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
            ) : (
              <Image source={{ uri: LOGO_PHOTO }} style={styles.headerLogo} contentFit="contain" />
            )}
            <TouchableOpacity
              activeOpacity={viewMode === "photos" ? 0.7 : 1}
              onPress={viewMode === "photos" ? handleBackToFolders : undefined}
              style={{ flex: 1, marginLeft: viewMode === "photos" ? 0 : 12 }}
            >
              <Text style={styles.headerTitle}>
                {viewMode === "folders" ? "All Photos" : (selectedFolder || "All Photos")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {viewMode === "folders" ? `${getFolders().length} Folders` : `${filteredPhotos.length} Memories`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/requests")}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search memories..."
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearch}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}

      <Animated.FlatList
        data={(viewMode === "folders" ? getFolders() : filteredPhotos) as any}
        keyExtractor={(item: any) => viewMode === "folders" ? item.name : item._id}
        renderItem={viewMode === "folders" ? renderFolderItem : renderPhotoItem}
        numColumns={COLUMN_COUNT}
        key={viewMode}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        itemLayoutAnimation={LinearTransition}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No photos found.</Text>
            <Text style={{ color: '#999', marginTop: 10 }}>Pull down to refresh</Text>
          </View>
        }
      />

      {/* FAB - Upload Button */}
      <Animated.View
        entering={FadeInDown.delay(600).springify()}
        style={styles.fabContainer}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={pickImage}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.fabIcon}>+</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Upload Modal */}
      <Modal visible={isUploadModalVisible} transparent animationType="slide" onRequestClose={() => setIsUploadModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload {previewImages.length} Memories</Text>

            <View style={{ maxHeight: 400 }}>
              <FlatList
                data={previewImages}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.multiPreviewContainer}>
                    <Image source={{ uri: item }} style={styles.multiPreviewImage} />
                    <TextInput
                      style={styles.multiTitleInput}
                      placeholder={`Title for photo #${index + 1}`}
                      value={newTitles[index]}
                      onChangeText={(text) => {
                        const updated = [...newTitles];
                        updated[index] = text;
                        setNewTitles(updated);
                      }}
                      placeholderTextColor="#999"
                    />
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: 10 }}
              />
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryContainer}>
              {["College Events", "Placements", "Sports", "Campus Life", "Other"].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    newCategory === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      newCategory === cat && styles.categoryTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newCategory === "Other" && (
              <TextInput
                style={[styles.input, { marginBottom: 15 }]}
                placeholder="Enter custom category..."
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholderTextColor="#999"
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsUploadModalVisible(false)} style={styles.actionButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={uploadImage} disabled={uploading} style={styles.actionButton}>
                {uploading ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <Text style={styles.createText}>Upload All</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>



      {/* Premium Photo Viewer */}
      <PhotoViewer
        visible={viewerOpen && isFocused}
        photos={filteredPhotos}
        startIndex={viewerIndex}
        currentUser={user}
        onClose={() => setViewerOpen(false)}
        onSwipe={(index) => {
          setViewerIndex(index);
          const p = filteredPhotos[index];
          if (p) incrementView(p._id);
        }}
        onLikeToggle={(id, isLiked, count) => {
          setPhotos(prev => prev.map(p => {
            if (p._id === id) {
              const newLikes = isLiked
                ? [...(p.likes || []), user?._id]
                : (p.likes || []).filter((uid: string) => uid !== user?._id);
              return { ...p, likes: newLikes };
            }
            return p;
          }));
        }}
      />

      {isSelectionMode && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkMove}>
            <Ionicons name="folder-open" size={24} color="#007AFF" />
            <Text style={styles.bulkActionText}>Move</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bulkActionBtn} onPress={handleBulkDeleteRequest}>
            <Ionicons name="trash" size={24} color="#FF3B30" />
            <Text style={[styles.bulkActionText, styles.bulkActionTextDanger]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // Clean white background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 65,
    paddingBottom: 25,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    backgroundColor: '#007AFF',
    zIndex: 100,
    elevation: 8,
  },
  backBtn: {
    marginRight: 15,
    padding: 5,
  },
  backIcon: {
    fontSize: 24,
    color: "#007AFF",
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 15,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  clearSearch: {
    padding: 4,
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
  backButton: {
    marginRight: 15,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 100, // Space for FAB
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  folderCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E6F2FF",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: "hidden",
  },
  folderImageContainer: {
    width: "100%",
    height: CARD_WIDTH * 0.8,
    backgroundColor: "#f8f8f8",
  },
  folderIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#007AFF', // Solid Elite Blue for contrast
    padding: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  folderIcon: {
    width: 22,
    height: 22,
  },
  folderPreview: {
    width: "100%",
    height: "100%",
  },
  folderDeleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  folderInfo: {
    padding: 12,
  },
  folderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  smallFolderIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    tintColor: "#007AFF",
  },
  folderName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a1a",
    flex: 1,
  },
  folderCount: {
    fontSize: 12,
    color: "#888",
    marginLeft: 22, // Align with text after icon
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.3, // Slightly taller for info
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden", // Clip image to rounded corners
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)", // Semi-transparent black
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  trashIcon: {
    width: 16,
    height: 16,
  },
  cardCategory: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  emptySubtext: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
  },
  fabContainer: {
    position: "absolute",
    bottom: 110, // Raised to avoid tab bar collision
    alignSelf: "center",
  },
  fab: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 32,
    color: "#fff",
    lineHeight: 34, // Adjust visual center
  },
  // Upload Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#333" },
  label: { fontSize: 14, fontWeight: "700", color: "#555", marginBottom: 8, marginTop: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#F8F9FA",
    color: "#333",
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F0F0F0",
    borderRadius: 25,
    marginRight: 8,
    marginBottom: 8,
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
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    resizeMode: "cover",
  },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  actionButton: { padding: 10 },
  cancelText: { color: "#FF3B30", fontSize: 17, fontWeight: "600" },
  createText: { color: "#007AFF", fontSize: 17, fontWeight: "bold" },

  multiPreviewContainer: {
    width: 250,
    marginRight: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  multiPreviewImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 10,
  },
  multiTitleInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#333',
  },

  // Zoom Styles
  zoomContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  fullImage: {
    width: width,
    height: "80%",
  },
  closeButton: {
    position: "absolute",
    right: 25,
    zIndex: 110,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(50,50,50,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pagerIndicator: {
    position: "absolute",
    left: 25,
    zIndex: 110,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(50,50,50,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  indicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  fullscreenInfo: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    borderRadius: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIconBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  editIcon: {
    width: 24,
    height: 24,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    paddingVertical: 5,
    marginRight: 10,
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: 5,
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 20,
  },
  fullscreenTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  fullscreenCategory: {
    color: '#00C6FF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  retryBtn: {
    marginTop: 15,
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  statusOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(255,165,0,0.85)', // Orange/Gold for pending
  },
  statusBadgeRejected: {
    backgroundColor: 'rgba(255,59,48,0.85)', // Red for rejected
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myUploadsBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  myUploadsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  myUploadsTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  myUploadItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  myUploadThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  myUploadInfo: {
    flex: 1,
    marginLeft: 15,
  },
  myUploadTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  myUploadMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  myUploadStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 5,
  },
  statusApproved: { backgroundColor: '#4CD964' },
  statusRejected: { backgroundColor: '#FF3B30' },
  statusPending: { backgroundColor: '#FF9500' },
  myUploadStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
    transform: [{ scale: 0.96 }],
  },
  selectionCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionCircleActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#007AFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    zIndex: 200,
  },
  selectionHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  selectionCancelBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  selectionCancelText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bulkActionBar: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: '#fff',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1000,
  },
  bulkActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    flex: 1,
  },
  bulkActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#007AFF',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  bulkActionTextDanger: {
    color: '#FF3B30',
  },
});
