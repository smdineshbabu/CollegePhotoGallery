import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  Dimensions,
  StatusBar,
  FlatList,
  ImageBackground,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useRouter, useFocusEffect, usePathname } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import api from "../../services/api";
import * as authService from "../../services/authService";
import * as authStorage from "../../services/authStorage";
import PhotoViewer from "../../components/PhotoViewer";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  LinearTransition
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const LOGO_PHOTO = "https://img.icons8.com/fluency/96/camera.png";
const POST_STORY_ICON = "https://img.icons8.com/fluency/96/add-camera.png";
const ALL_PHOTOS_ICON = "https://img.icons8.com/fluency/96/stack-of-photos.png";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800";

const ParallaxItem = memo(({ item, index, scrollX, onPress }: any) => {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * 212, // 200 width + 12 margin
      index * 212,
      (index + 1) * 212,
    ];
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-30, 0, 30],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => onPress(index, item.imageUrl)}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.parallaxContainer, animatedStyle]}>
        <Image
          source={{
            uri: item.thumbnailUrl || item.imageUrl,
            headers: { "bypass-tunnel-reminder": "true" }
          }}
          style={styles.parallaxImage}
          transition={300}
        />
      </Animated.View>
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.itemOverlay}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, folders: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [updating, setUpdating] = useState(false);
  const sessionViewedIds = useRef<Set<string>>(new Set());

  // Server Settings State
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const pathname = usePathname();

  useEffect(() => {
    const loadUrl = async () => {
      const url = await authStorage.getServerUrl();
      setServerUrl(url || "http://10.73.154.112:5000/api");
    };
    loadUrl();
  }, []);

  const handleSaveUrl = async () => {
    if (!serverUrl.trim()) return;
    await authStorage.saveServerUrl(serverUrl.trim());
    setIsSettingsVisible(false);
    Alert.alert("Success", "Server URL updated! App will now connect to " + serverUrl);
    fetchRecentPhotos(true);
  };

  const handleResetDefault = async () => {
    const defaultUrl = "10.73.154.112:5000";
    setServerUrl(defaultUrl);
    await authStorage.saveServerUrl(defaultUrl);
    Alert.alert("Reset", "Server URL reset to default! Refreshing...");
    setIsSettingsVisible(false);
    fetchRecentPhotos(true);
  };

  const [testing, setTesting] = useState(false);
  const handleTestConnection = async () => {
    let url = serverUrl.replace(/\s/g, "");
    if (!url.startsWith("http")) url = "http://" + url;
    if (url.endsWith("/")) url = url.slice(0, -1);
    if (!url.endsWith("/api")) url += "/api";

    try {
      setTesting(true);
      const response = await fetch(`${url}/upload`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok || response.status === 401 || response.status === 403) {
        Alert.alert("Success", `Reached server at ${url}!\nStatus: ${response.status}`);
      } else {
        Alert.alert("Failed", `Server reached but returned error: ${response.status}\nURL: ${url}`);
      }
    } catch (err: any) {
      Alert.alert("Connection Error", `Could not reach ${url}\n\nError: ${err.message}\n\n1. Check if phone is on the SAME hotspot.\n2. Check Windows Firewall.`);
    } finally {
      setTesting(false);
    }
  };

  const scrollX = useSharedValue(0);

  const incrementView = async (id: string) => {
    if (!id || sessionViewedIds.current.has(id)) return;
    try {
      sessionViewedIds.current.add(id);
      await api.patch(`/upload/${id}/view`);
    } catch (error) {
      if (__DEV__) console.log("Home View update failed:", id);
    }
  };

  const handleUpdateTitle = async (id: string) => {
    if (!editingTitle.trim()) {
      Alert.alert("Error", "Title cannot be empty");
      return;
    }
    try {
      setUpdating(true);
      await api.patch(`/upload/${id}`, { title: editingTitle });

      // Update local state for recentPhotos
      setRecentPhotos(prev => prev.map(p => p._id === id ? { ...p, title: editingTitle } : p));

      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Home update error:", error);
      Alert.alert("Error", "Failed to update title");
    } finally {
      setUpdating(false);
    }
  };

  const startEditing = (currentTitle: string) => {
    setEditingTitle(currentTitle);
    setIsEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeletePhoto = async (id: string) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this memory? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdating(true);
              await api.delete(`/upload/${id}`);
              setRecentPhotos(prev => prev.filter(p => p._id !== id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("Delete home photo error:", error);
              Alert.alert("Error", "Failed to delete photo");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const currentItem = viewableItems[0].item;
      incrementView(currentItem._id);
    }
  }, []);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const fetchUserData = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.log("No user logged in");
    }
  };

  const fetchRecentPhotos = async (showLoading = true) => {
    try {
      setError(null);
      if (showLoading) setLoading(true);

      await fetchUserData();
      const urlToFetch = "/upload";
      // console.log("[HOME] Fetching from:", urlToFetch);
      const response = await api.get(urlToFetch);
      // console.log("[HOME] API Response:", response.data.length, "photos");

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
            return `${baseApiUrl}${url}`;
          }
          // If it's an absolute URL (http...), strip the domain and use current base
          if (url.startsWith("http")) {
            const parts = url.split("/uploads/");
            if (parts.length > 1) {
              return `${baseApiUrl}/uploads/${parts[1]}`;
            }
          }
          // Fallback
          return url;
        };

        return {
          ...p,
          imageUrl: fixUrl(p.imageUrl) || p.imageUrl,
          thumbnailUrl: fixUrl(p.thumbnailUrl) || p.thumbnailUrl || fixUrl(p.imageUrl),
        };
      });

      const validPhotos = standardizedPhotos.filter((p: any) => {
        // ONLY show approved photos on Home screen
        if (p.status !== 'approved') return false;

        const folder = (p.folder || "").toLowerCase();
        const title = (p.title || "").toLowerCase();
        // Skip anything related to recovered/restored
        const isExcluded = folder.includes("recovered") ||
          folder.includes("restored") ||
          title.includes("recovered") ||
          title.includes("restored");
        return p.imageUrl && !isExcluded;
      });

      // Only log if count changes to avoid spamming
      if (validPhotos.length !== recentPhotos.length) {
        console.log("[HOME] Live Update: ", validPhotos.length, " photos");
      }

      setRecentPhotos(validPhotos);

      const folders = new Set(validPhotos.map((p: any) => p.folder || "General")).size;
      setStats({ total: validPhotos.length, folders });
    } catch (err: any) {
      console.error("[HOME] Detailed Error:", {
        name: err.name,
        message: err.message,
        status: err.response?.status,
        url: err.config?.url
      });

      if (showLoading) {
        const errorMsg = `Error: ${err.message || 'Unknown'}\nStatus: ${err.response?.status || 'No Response'}\nCheck Gear Settings URL.`;
        setError(errorMsg);
      }
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  // Live Updates: Auto-refresh every 5 seconds when focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!isActive) return;
        await fetchRecentPhotos(false); // Pass false to suppress full loading state
      };

      loadData(); // Initial load

      const interval = setInterval(loadData, 5000);

      return () => {
        isActive = false;
        clearInterval(interval);
        // Cleanup state when leaving screen
        setViewerOpen(false);
        setIsEditing(false);
      };
    }, [])
  );

  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    fetchRecentPhotos(true).finally(() => setRefreshing(false));
  }, []);

  const categories = [
    { id: '1', name: 'College Events', icon: '🎉', color: '#007AFF' },
    { id: '2', name: 'Sports', icon: '🏆', color: '#00C7BE' }, // Changed from #5856D6 (purple) to teal/blue
    { id: '3', name: 'Campus Life', icon: '🏛️', color: '#34C759' }, // Green for contrast
    { id: '4', name: 'Placements', icon: '💼', color: '#004085' },
  ];

  const totalViews = recentPhotos.reduce((sum, p) => sum + (Number(p.views) || 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <LinearGradient
        colors={["#007AFF", "#00C6FF"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            <Image source={{ uri: LOGO_PHOTO }} style={styles.headerLogo} contentFit="contain" />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.headerTitle}>College Gallery</Text>
            <Text style={styles.headerSubtitle}>Capture & Share Memories</Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsSettingsVisible(true)}
            style={{ padding: 10 }}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.sparkles}>✨</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {/* Stats Section - Elite Glassmorphism */}
        <View style={styles.statsWrapper}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>MEMORIES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.folders}</Text>
              <Text style={styles.statLabel}>FOLDERS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalViews}</Text>
              <Text style={styles.statLabel}>TOTAL VIEWS</Text>
            </View>
          </View>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresContainer}>
          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => router.push("/(tabs)/upload")}
            activeOpacity={0.8}
          >
            <View style={styles.featureIcon}>
              <Image source={{ uri: POST_STORY_ICON }} style={styles.fluentIcon} contentFit="contain" />
            </View>
            <Text style={styles.featureTitle}>Post Story</Text>
            <Text style={styles.featureSubtitle}>New moment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            onPress={() => router.navigate({ pathname: "/(tabs)/gallery", params: { folder: undefined } })}
            activeOpacity={0.8}
          >
            <View style={styles.featureIcon}>
              <Image source={{ uri: ALL_PHOTOS_ICON }} style={styles.fluentIcon} contentFit="contain" />
            </View>
            <Text style={styles.featureTitle}>All Photos</Text>
            <Text style={styles.featureSubtitle}>Quick browse</Text>
          </TouchableOpacity>
        </View>

        {/* New: My Memories Quick Access */}
        <View style={[styles.featuresContainer, { marginTop: 15 }]}>
          <TouchableOpacity
            style={[styles.featureCard, { width: width - 40, flexDirection: 'row', padding: 15 }]}
            onPress={() => router.push("/my-memories")}
            activeOpacity={0.8}
          >
            <View style={[styles.featureIcon, { marginBottom: 0, marginRight: 15 }]}>
              <Ionicons name="cloud-done" size={32} color="#007AFF" />
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={styles.featureTitle}>My Memories</Text>
              <Text style={styles.featureSubtitle}>Track your shared moments and status</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Recent Highlights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🌟</Text>
              <Text style={styles.sectionTitle}>Recent Highlights</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{error}</Text>
            </View>
          ) : recentPhotos.length > 0 ? (
            <Animated.FlatList
              horizontal
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
              data={recentPhotos.slice(0, 10)}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item, index }) => (
                <ParallaxItem
                  item={item}
                  index={index}
                  scrollX={scrollX}
                  onPress={(idx: number, url: string) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setViewerIndex(idx);
                    setViewerOpen(true);
                  }}
                />
              )}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent highlights yet.</Text>
            </View>
          )}
        </View>

        {/* Explore Categories - 2x2 Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionIcon}>🔍</Text>
              <Text style={styles.sectionTitle}>Explore Categories</Text>
            </View>
          </View>
          <View style={styles.categoriesGrid}>
            {categories.map((cat, index) => (
              <Animated.View
                key={cat.id}
                entering={FadeInDown.delay(200 * index).springify()}
              >
                <TouchableOpacity
                  style={styles.categoryCard}
                  onPress={() => {
                    // Use string path for more reliable tab navigation with params
                    router.push(`/(tabs)/gallery?folder=${encodeURIComponent(cat.name)}`);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                    <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Spotlight Memory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spotlight Memory</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (recentPhotos.length > 0) {
                // Show the CURRENT image in viewer
                setViewerIndex(spotlightIndex);
                setViewerOpen(true);
                incrementView(recentPhotos[spotlightIndex]._id);

                // Seamlessly cycle the background image for next time
                const nextIdx = (spotlightIndex + 1) % recentPhotos.length;
                setSpotlightIndex(nextIdx);
              }
            }}
          >
            <View style={styles.spotlightContainer}>
              <ImageBackground
                source={{
                  uri: recentPhotos[spotlightIndex]?.imageUrl || FALLBACK_IMAGE,
                  headers: { "bypass-tunnel-reminder": "true" }
                }}
                style={styles.spotlightImage}
                imageStyle={{ borderRadius: 25 }}
              >
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)"]}
                  style={styles.spotlightOverlay}
                >
                  <View style={styles.spotlightBadge}>
                    <Text style={styles.badgeText}>🔥 SPOTLIGHT</Text>
                  </View>
                  <View style={styles.spotlightInfo}>
                    <Text style={styles.spotlightTitle}>{recentPhotos[spotlightIndex]?.title || "Campus Life"}</Text>
                    <Text style={styles.spotlightSubtitle}>
                      {recentPhotos[spotlightIndex]?.folder || "Memories"} • Captured by Hub
                    </Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Premium Photo Viewer */}
      {/* Premium Photo Viewer */}
      <PhotoViewer
        visible={viewerOpen && isFocused}
        photos={recentPhotos.slice(0, 10)}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onSwipe={(index: number) => {
          setViewerIndex(index);
          const p = recentPhotos[index];
          if (p) incrementView(p._id);
        }}
        onRename={async (id: string, newTitle: string) => {
          await api.patch(`/upload/${id}`, { title: newTitle });
          setRecentPhotos(prev => prev.map(p => p._id === id ? { ...p, title: newTitle } : p));
        }}
        onDelete={async (id: string) => {
          await api.delete(`/upload/${id}`);
          setRecentPhotos(prev => prev.filter(p => p._id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* Server Settings Modal */}
      <Modal visible={isSettingsVisible} transparent animationType="fade" onRequestClose={() => setIsSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Server Configuration</Text>
            <Text style={styles.modalSubtitle}>Update if your IP changes</Text>

            <TextInput
              style={styles.modalInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://10.73.154.112:5000/api"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#34C759', marginBottom: 10 }]}
              onPress={handleTestConnection}
              disabled={testing}
            >
              {testing ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Test Connection</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#FF9500', marginBottom: 10 }]}
              onPress={handleResetDefault}
            >
              <Text style={styles.saveButtonText}>Reset to Default (10.73.154.112)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveUrl}>
              <Text style={styles.saveButtonText}>Save URL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#FF3B30', marginTop: 10 }]}
              onPress={async () => {
                await authService.logout();
                router.replace("/login");
              }}
            >
              <Text style={styles.saveButtonText}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsSettingsVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 55,
    paddingBottom: 10,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 55,
    height: 55,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  headerLogo: {
    width: '85%',
    height: '85%',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 2,
  },
  sparkles: {
    fontSize: 28,
  },
  statsWrapper: {
    marginHorizontal: 20,
    marginTop: 15, // Space below header instead of overlap
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: 20,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#007AFF',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '800',
    letterSpacing: 1,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 25,
  },
  featureCard: {
    backgroundColor: '#fff',
    width: (width - 60) / 2,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F7FF',
  },
  fluentIcon: {
    width: 32,
    height: 32,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  section: {
    marginTop: 35,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 15,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  refreshBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  refreshButton: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recentItem: {
    width: 200,
    height: 150,
    borderRadius: 16,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  parallaxContainer: {
    width: '120%',
    height: '100%',
    marginLeft: '-10%',
  },
  parallaxImage: {
    width: '100%',
    height: '100%',
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
  itemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 15,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (width - 60) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 13, // Slightly smaller to prevent wrapping
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  spotlightContainer: {
    width: width - 40,
    height: 220,
    alignSelf: 'center',
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    marginTop: 15,
    marginHorizontal: 20,
  },
  spotlightImage: {
    width: '100%',
    height: '100%',
  },
  spotlightOverlay: {
    flex: 1,
    padding: 25,
    justifyContent: 'flex-end',
  },
  spotlightBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  spotlightInfo: {
    marginTop: 10,
  },
  spotlightTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  spotlightSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  zoomContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullImage: {
    width: width,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
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
    position: 'absolute',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: 20,
    color: '#1a1a1a',
  },
  saveButton: {
    backgroundColor: "#007AFF",
    width: "100%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 12,
    padding: 12,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
});
