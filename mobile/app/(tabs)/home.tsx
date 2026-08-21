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
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useState, useEffect, useCallback, memo, useRef, useMemo } from "react";
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
  LinearTransition,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withSpring,
  useDerivedValue,
  useAnimatedSensor,
  SensorType,
  cancelAnimation,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const SPRING_CONFIG = { damping: 12, stiffness: 200 };

const LOGO_PHOTO = "https://img.icons8.com/fluency/96/camera.png";
const POST_STORY_ICON = "https://img.icons8.com/fluency/96/add-camera.png";
const ALL_PHOTOS_ICON = "https://img.icons8.com/fluency/96/stack-of-photos.png";
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800";

const getCircleConfig = (width: number, height: number) => {
  const configs = [];
  const colors = ['#FF0000', '#FF8C00', '#FFD700', '#00FF00', '#00BFFF', '#0000FF', '#8A2BE2', '#FF00FF', '#FF1493']; // Enriched saturated colors
  // Increased to 20 bubbles for a cleaner, balanced atmosphere
  for (let i = 0; i < 20; i++) {
    configs.push({
      color: colors[i % colors.length],
      size: 70 + Math.random() * 40, // 70-110px
      top: Math.random() * height,
      left: Math.random() * width,
      phase: Math.random() * Math.PI * 2,
      radiusX: 50 + Math.random() * 100, // Increased for wider coverage
      radiusY: 50 + Math.random() * 100,
      freqX: 0.7 + Math.random() * 0.6, // Decoupled frequencies
      freqY: 0.7 + Math.random() * 0.6,
      speed: 0.8 + Math.random() * 0.4,
    });
  }
  return configs;
};

// --- REFINED LIQUID UI COMPONENT ---

const LiquidCircle = memo(({ circle }: any) => {
  const localTime = useSharedValue(0);

  useEffect(() => {
    localTime.value = withRepeat(
      withTiming(2 * Math.PI, {
        duration: (4500 + Math.random() * 2500), // Graceful 4.5-7s duration
        easing: Easing.inOut(Easing.sin)
      }),
      -1,
      true // Reverse for 100% seamless "no-cut" loop
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // 1. LISSAJOUS NATURAL MOTION (Covers all sides better)
    const swayX = Math.sin((localTime.value * circle.freqX) + circle.phase) * circle.radiusX;
    const swayY = Math.cos((localTime.value * circle.freqY) + circle.phase) * circle.radiusY;

    // 2. SCALE
    const scale = 1 + Math.sin(localTime.value + circle.phase) * 0.2;

    return {
      transform: [
        { translateX: swayX },
        { translateY: swayY },
        { scale: scale }
      ]
    };
  });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: circle.color,
          width: circle.size,
          height: circle.size,
          borderRadius: circle.size / 2,
          opacity: 1.0,
          position: 'absolute',
          top: circle.top as any,
          left: circle.left as any,
        },
        animatedStyle
      ]}
    />
  );
});

const LiquidBackground = memo(({ scrollY }: any) => {
  const { width, height } = useWindowDimensions();
  const circleConfig = useMemo(() => getCircleConfig(width, height), [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {circleConfig.map((circle, i) => (
        <LiquidCircle
          key={i}
          circle={circle}
        />
      ))}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
    </View>
  );
});

const TrendingNewsCard = memo(({ item, index, onPress, scrollX, velocity }: any) => {
  const isViral = (item.likes?.length || 0) > 5 || (item.views || 0) > 20;
  const CARD_WIDTH = width * 0.82;
  const CARD_MARGIN = 20;
  const SNAP = CARD_WIDTH + CARD_MARGIN;

  // High-Visual: Breathing Animation for cards
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(1, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      false
    );
    if (isViral) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    }
  }, [isViral]);

  // Smooth Ball / Spherical Scroll Effect
  const animatedCardStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 2) * SNAP,
      (index - 1) * SNAP,
      index * SNAP,
      (index + 1) * SNAP,
      (index + 2) * SNAP,
    ];
    const sphereScale = scrollX ? interpolate(
      scrollX.value,
      inputRange,
      [0.82, 0.9, 1, 0.9, 0.82],
      Extrapolate.CLAMP
    ) : 1;
    const rotateY = scrollX ? interpolate(
      scrollX.value,
      inputRange,
      [20, 10, 0, -10, -20],
      Extrapolate.CLAMP
    ) : 0;
    const translateY = scrollX ? interpolate(
      scrollX.value,
      inputRange,
      [12, 5, 0, 5, 12],
      Extrapolate.CLAMP
    ) : 0;
    const itemOpacity = scrollX ? interpolate(
      scrollX.value,
      inputRange,
      [0.5, 0.75, 1, 0.75, 0.5],
      Extrapolate.CLAMP
    ) : 1;

    return {
      transform: [
        { perspective: 1000 },
        { translateY },
        { scale: sphereScale * scale.value },
        { rotateY: `${rotateY}deg` },
      ],
      opacity: itemOpacity,
      shadowOpacity: interpolate(scale.value, [1, 1.02], [0.2, 0.4])
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: isViral ? glowOpacity.value : 0,
    transform: [{ scale: 1.1 }]
  }));

  return (
    <Animated.View style={[styles.trendingNewsCardContainer, animatedCardStyle]}>
      {/* Dynamic Glow Aura for Viral Items */}
      {isViral && (
        <Animated.View style={[styles.viralGlow, glowStyle]}>
          <LinearGradient
            colors={["rgba(255,59,48,0.5)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <TouchableOpacity
        style={styles.trendingNewsCard}
        onPress={() => onPress(index)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.thumbnailUrl || item.imageUrl }}
          style={styles.trendingNewsImage}
          contentFit="cover"
          transition={200}
          priority="high"
          recyclingKey={item._id}
        />

        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.98)"]}
          style={styles.trendingNewsOverlay}
          locations={[0, 0.5, 0.95]}
        >
          <View style={styles.trendingBadgeRow}>
            <View style={[styles.newsBadge, isViral ? styles.viralBadge : styles.trendingBadge]}>
              <Text style={styles.newsBadgeText}>{isViral ? "🔥 VIRAL" : "⚡ TRENDING"}</Text>
            </View>
          </View>

          <View style={styles.trendingNewsContent}>
            <Text style={styles.trendingNewsHeadline} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.trendingMetaRow}>
              <View style={styles.newsStatItem}>
                <LinearGradient
                  colors={["#007AFF", "#00C6FF"]}
                  style={styles.newsStatIconBg}
                >
                  <Ionicons name="eye" size={10} color="#fff" />
                </LinearGradient>
                <Text style={styles.newsStatValue}>{item.views || 0}</Text>
                <Text style={styles.newsStatLabel}>VIEWS</Text>
              </View>

              <View style={styles.newsStatDivider} />

              <View style={styles.newsStatItem}>
                <LinearGradient
                  colors={["#FF3B30", "#FF2D55"]}
                  style={styles.newsStatIconBg}
                >
                  <Ionicons name="heart" size={10} color="#fff" />
                </LinearGradient>
                <Text style={styles.newsStatValue}>{item.likes?.length || 0}</Text>
                <Text style={styles.newsStatLabel}>LIKES</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

// --- LAYOUT CONSTANTS FOR ZERO-JITTER ---
const HOME_HEIGHTS = {
  features: 195,
  myMemories: 120,
  trending: 330,
  highlights: 260,
  categories: 310,
  spotlight: 320,
  spacer: 10
};

const SECTION_GAP = 35;

const ParallaxItem = memo(({ item, index, scrollX, onPress, velocity }: any) => {
  const ITEM_WIDTH = 200;
  const ITEM_MARGIN = 12;
  const SNAP = ITEM_WIDTH + ITEM_MARGIN;

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 2) * SNAP,
      (index - 1) * SNAP,
      index * SNAP,
      (index + 1) * SNAP,
      (index + 2) * SNAP,
    ];
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-50, -25, 0, 25, 50],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [15, 6, 0, 6, 15],
      Extrapolate.CLAMP
    );
    const sphereScale = interpolate(
      scrollX.value,
      inputRange,
      [0.82, 0.9, 1, 0.9, 0.82],
      Extrapolate.CLAMP
    );
    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [25, 12, 0, -12, -25],
      Extrapolate.CLAMP
    );
    const itemOpacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 0.7, 1, 0.7, 0.4],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { perspective: 800 },
        { translateX },
        { translateY },
        { scale: sphereScale },
        { rotateY: `${rotateY}deg` },
      ],
      opacity: itemOpacity,
    };
  });

  return (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => onPress(index)}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.parallaxContainer, animatedStyle]}>
        <Image
          source={{
            uri: item.thumbnailUrl || item.imageUrl,
            headers: { "bypass-tunnel-reminder": "true" }
          }}
          style={styles.parallaxImage}
          contentFit="cover"
          recyclingKey={item._id}
        />
      </Animated.View>
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.itemOverlay}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          {item.likes && item.likes.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="heart" size={12} color="#FF3B30" style={{ marginRight: 2 }} />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{item.likes.length}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});


const HomeFeatures = memo(({ onPostStory, onAllPhotos }: any) => {
  return (
    <View style={[styles.featuresContainer, { height: HOME_HEIGHTS.features, marginTop: 0, paddingTop: SECTION_GAP }]}>
      <TouchableOpacity style={styles.featureCard} onPress={onPostStory} activeOpacity={0.8}>
        <View style={styles.featureIcon}>
          <Image source={{ uri: POST_STORY_ICON }} style={styles.fluentIcon} contentFit="contain" />
        </View>
        <Text style={styles.featureTitle}>Post Story</Text>
        <Text style={styles.featureSubtitle}>New moment</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.featureCard} onPress={onAllPhotos} activeOpacity={0.8}>
        <View style={styles.featureIcon}>
          <Image source={{ uri: ALL_PHOTOS_ICON }} style={styles.fluentIcon} contentFit="contain" />
        </View>
        <Text style={styles.featureTitle}>All Photos</Text>
        <Text style={styles.featureSubtitle}>Quick browse</Text>
      </TouchableOpacity>
    </View>
  );
});

const HomeMyMemories = memo(({ onPress }: any) => {
  return (
    <View style={[styles.featuresContainer, { height: HOME_HEIGHTS.myMemories, marginTop: 0, paddingTop: SECTION_GAP }]}>
      <TouchableOpacity
        style={[styles.featureCard, { width: width - 40, flexDirection: 'row', padding: 15 }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.featureIcon, { marginBottom: 0, marginRight: 15 }]}>
          <Image source={{ uri: "https://img.icons8.com/fluency/48/cloud-checked.png" }} style={{ width: 32, height: 32 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.featureTitle}>My Memories</Text>
          <Text style={styles.featureSubtitle}>Track your shared moments and status</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#888" />
      </TouchableOpacity>
    </View>
  );
});

const HomeTrending = memo(({ trendingPhotos, onPhotoPress }: any) => {
  const trendingCardWidth = width * 0.82;
  const trendingMargin = 20;
  const trendingSnapInterval = trendingCardWidth + trendingMargin;
  const trendingScrollX = useSharedValue(0);

  const trendingScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      trendingScrollX.value = event.contentOffset.x;
    }
  });

  return (
    <View style={{ height: HOME_HEIGHTS.trending, paddingTop: SECTION_GAP }}>
      <View style={[styles.trendingTickerHeader, { marginBottom: 15 }]}>
        <LinearGradient colors={["#FF3B30", "#FF9500"]} style={styles.tickerBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={styles.tickerBadgeText}>NEWS</Text>
        </LinearGradient>
        <View style={styles.tickerContent}>
          <Text style={styles.tickerText}>Trending Today • High Engagement Memories</Text>
        </View>
      </View>

      <Animated.FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={trendingPhotos}
        keyExtractor={(item: any) => `trending-${item._id}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 15 }}
        snapToInterval={trendingSnapInterval}
        decelerationRate={0.985}
        snapToAlignment="start"
        onScroll={trendingScrollHandler}
        scrollEventThrottle={4}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews={false}
        renderItem={({ item, index }: any) => (
          <View style={{ width: trendingCardWidth, marginRight: trendingMargin }}>
            <TrendingNewsCard
              item={item}
              index={index}
              onPress={() => onPhotoPress(index)}
              scrollX={trendingScrollX}
            />
          </View>
        )}
      />
    </View>
  );
});

const HomeHighlights = memo(({ recentPhotos, scrollX, onPhotoPress }: any) => {
  const highlightWidth = 200;
  const highlightMargin = 12;
  const highlightSnapInterval = highlightWidth + highlightMargin;

  const highlightScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    }
  });

  return (
    <View style={{ height: HOME_HEIGHTS.highlights, paddingTop: SECTION_GAP }}>
      <View style={[styles.sectionHeader, { marginBottom: 15 }]}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="flash" size={22} color="#FF9500" style={styles.sectionIconComponent} />
          <Text style={styles.sectionTitle}>Recent Highlights</Text>
        </View>
      </View>
      <Animated.FlatList
        horizontal
        onScroll={highlightScrollHandler}
        scrollEventThrottle={4}
        showsHorizontalScrollIndicator={false}
        data={recentPhotos}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        snapToInterval={highlightSnapInterval}
        decelerationRate={0.985}
        snapToAlignment="start"
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={7}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <View style={{ width: highlightWidth, marginRight: highlightMargin }}>
            <ParallaxItem
              item={item}
              index={index}
              scrollX={scrollX}
              onPress={onPhotoPress}
            />
          </View>
        )}
      />
    </View>
  );
});

const HomeCategories = memo(({ categories, onCategoryPress }: any) => {
  return (
    <View style={{ height: HOME_HEIGHTS.categories, paddingTop: SECTION_GAP }}>
      <View style={[styles.sectionHeader, { marginBottom: 15 }]}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="apps" size={22} color="#5856D6" style={styles.sectionIconComponent} />
          <Text style={styles.sectionTitle}>Explore Categories</Text>
        </View>
      </View>
      <View style={styles.categoriesGrid}>
        {categories.map((cat: any) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryCard, { borderColor: cat.color + '30' }]}
            onPress={() => onCategoryPress(cat.name)}
            activeOpacity={0.8}
          >
            <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
              <Text style={styles.categoryEmoji}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const HomeSpotlight = memo(({ photo, onPhotoPress, spotlightIndex }: any) => {
  return (
    <View style={{ height: HOME_HEIGHTS.spotlight, paddingTop: SECTION_GAP }}>
      <View style={[styles.sectionHeader, { marginBottom: 15 }]}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="diamond" size={22} color="#FF2D55" style={styles.sectionIconComponent} />
          <Text style={styles.sectionTitle}>Spotlight Memory</Text>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPhotoPress(spotlightIndex)}>
        <View style={styles.spotlightContainer}>
          <Image
            source={{ uri: photo?.imageUrl || FALLBACK_IMAGE }}
            style={[StyleSheet.absoluteFill, { borderRadius: 25 }]}
            contentFit="cover"
            priority="high"
            recyclingKey={photo?._id}
          />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.spotlightOverlay}>
            <View style={styles.spotlightBadge}>
              <Text style={styles.badgeText}>🔥 SPOTLIGHT</Text>
            </View>
            <View style={styles.spotlightInfo}>
              <Text style={styles.spotlightTitle}>{photo?.title || "Campus Life"}</Text>
              <Text style={styles.spotlightSubtitle}>
                {photo?.folder || "Memories"} • Captured by Hub
              </Text>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
  const [trendingPhotos, setTrendingPhotos] = useState<any[]>([]);
  const [viewerPhotos, setViewerPhotos] = useState<any[]>([]);
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

  // Performance & Visual Shared Values
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const shimValue = useSharedValue(-1);
  const pulseValue = useSharedValue(1);

  const headerScaleStyle = useAnimatedStyle(() => {
    // Scale header when pulling down (overscroll)
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.15, 1],
      Extrapolate.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [-100, 0],
      [20, 0],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const mainScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  useEffect(() => {
    // Lively slow shimmer - slightly faster for "life"
    shimValue.value = withRepeat(
      withTiming(1, { duration: 4500, easing: Easing.linear }),
      -1,
      false
    );

    // Subtle breathing pulse for logo
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimValue.value, [-1, 1], [-width * 1.5, width * 1.5]) }],
    opacity: interpolate(shimValue.value, [-1, -0.2, 0, 0.2, 1], [0, 0, 0.4, 0, 0])
  }));

  const logoPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }]
  }));


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


  const listData = useMemo(() => {
    // Standardized structure to prevent layout popping
    return [
      { type: 'features' },
      { type: 'myMemories' },
      { type: 'trending' },
      { type: 'highlights' },
      { type: 'categories' },
      { type: 'spotlight' }
    ];
  }, []);

  const categories = useMemo(() => [
    { id: '1', name: 'College Events', icon: '🎉', color: '#007AFF' },
    { id: '2', name: 'Sports', icon: '🏆', color: '#00C7BE' },
    { id: '3', name: 'Campus Life', icon: '🏛️', color: '#34C759' },
    { id: '4', name: 'Placements', icon: '💼', color: '#004085' },
  ], []);


  const fetchUserData = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.log("No user logged in");
    }
  };

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });



  const handlePostStory = useCallback(() => router.push("/(tabs)/upload"), [router]);
  const handleAllPhotos = useCallback(() => router.navigate({ pathname: "/(tabs)/gallery", params: { folder: undefined } }), [router]);
  const handleMyMemories = useCallback(() => router.push("/my-memories"), [router]);
  const handleTrendingPress = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setViewerPhotos(trendingPhotos);
    setViewerIndex(idx);
    setViewerOpen(true);
  }, [trendingPhotos]);

  const handleHighlightPress = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerPhotos(recentPhotos);
    setViewerIndex(idx);
    setViewerOpen(true);
  }, [recentPhotos]);

  const handleCategoryPress = useCallback((name: string) => {
    router.push(`/(tabs)/gallery?folder=${encodeURIComponent(name)}&source=explore`);
  }, [router]);

  const onSpotlightPhotoPress = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const spotlightPool = recentPhotos.length > 0 ? recentPhotos : trendingPhotos;
    const currentSpotlight = spotlightPool[spotlightIndex % spotlightPool.length];
    if (spotlightPool.length > 0) {
      setViewerPhotos(spotlightPool);
      setViewerIndex(idx % spotlightPool.length);
      setViewerOpen(true);
      incrementView(currentSpotlight._id);
      // Jump to a new random image next time for variety
      const nextIdx = (spotlightIndex + 1 + Math.floor(Math.random() * 2)) % spotlightPool.length;
      setSpotlightIndex(nextIdx);
    }
  }, [recentPhotos, trendingPhotos, spotlightIndex]);

  const getItemLayout = useCallback((data: any, index: number) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const type = data[i].type as keyof typeof HOME_HEIGHTS;
      offset += HOME_HEIGHTS[type] || 0;
    }
    const currentType = data[index].type as keyof typeof HOME_HEIGHTS;
    return {
      length: HOME_HEIGHTS[currentType] || 0,
      offset: offset,
      index,
    };
  }, []);
  const renderItem = useCallback(({ item }: any) => {
    switch (item.type) {
      case 'features':
        return <HomeFeatures onPostStory={handlePostStory} onAllPhotos={handleAllPhotos} />;
      case 'myMemories':
        return <HomeMyMemories onPress={handleMyMemories} />;
      case 'trending':
        if (trendingPhotos.length === 0) return <View style={{ height: HOME_HEIGHTS.trending }} />;
        return <HomeTrending trendingPhotos={trendingPhotos} onPhotoPress={handleTrendingPress} />;
      case 'highlights':
        if (recentPhotos.length === 0) return <View style={{ height: HOME_HEIGHTS.highlights }} />;
        return <HomeHighlights recentPhotos={recentPhotos} scrollX={scrollX} onPhotoPress={handleHighlightPress} />;
      case 'categories':
        return <HomeCategories categories={categories} onCategoryPress={handleCategoryPress} />;
      case 'spotlight':
        const spotlightPool = recentPhotos.length > 0 ? recentPhotos : trendingPhotos;
        if (spotlightPool.length === 0) return <View style={{ height: HOME_HEIGHTS.spotlight }} />;
        return (
          <HomeSpotlight
            photo={spotlightPool[spotlightIndex % spotlightPool.length]}
            onPhotoPress={onSpotlightPhotoPress}
            spotlightIndex={spotlightIndex}
          />
        );
      default:
        return null;
    }
  }, [
    trendingPhotos, recentPhotos, spotlightIndex, scrollX, categories,
    handlePostStory, handleAllPhotos, handleMyMemories, handleTrendingPress, handleHighlightPress, handleCategoryPress, onSpotlightPhotoPress
  ]);

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


  const fetchRecentPhotos = async (showLoading = true) => {
    try {
      setError(null);
      if (showLoading) setLoading(true);

      await fetchUserData();
      const urlToFetch = "/upload?status=approved";
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
        const folder = (p.folder || "").toLowerCase();
        const title = (p.title || "").toLowerCase();
        // Skip anything related to recovered/restored
        const isExcluded = folder.includes("recovered") ||
          folder.includes("restored") ||
          title.includes("recovered") ||
          title.includes("restored");
        return p.imageUrl && !isExcluded;
      });


      // Deep-equality check to prevent unnecessary re-renders during polling
      const isDifferent = JSON.stringify(validPhotos) !== JSON.stringify(recentPhotos);
      if (isDifferent) {
        setRecentPhotos(validPhotos);
      }
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

  const fetchTrendingPhotos = async () => {
    try {
      const response = await api.get("/upload/trending");

      const storedUrl = await authStorage.getServerUrl();
      let baseRaw = (storedUrl || api.defaults.baseURL || "http://10.73.154.112:5000/api");
      if (!baseRaw.startsWith("http")) baseRaw = "http://" + baseRaw;
      const baseApiUrl = baseRaw.replace("/api", "").replace(/\/$/, "");

      const standardized = response.data.map((p: any) => {
        const fixUrl = (url: string) => {
          if (!url) return null;
          if (url.startsWith("/uploads")) return `${baseApiUrl}${url}`;
          if (url.startsWith("http")) {
            const parts = url.split("/uploads/");
            if (parts.length > 1) return `${baseApiUrl}/uploads/${parts[1]}`;
          }
          return url;
        };
        return {
          ...p,
          imageUrl: fixUrl(p.imageUrl) || p.imageUrl,
          thumbnailUrl: fixUrl(p.thumbnailUrl) || p.thumbnailUrl || fixUrl(p.imageUrl),
        };
      });

      const isDifferent = JSON.stringify(standardized) !== JSON.stringify(trendingPhotos);
      if (isDifferent) {
        setTrendingPhotos(standardized);
      }
    } catch (err) {
      console.error("[HOME] Trending fetch failed:", err);
    }
  };

  // Caching State
  const lastFetchedRef = useRef(0);
  const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // Live Updates: Auto-refresh only if stale
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!isActive) return;

        // Skip fetch if within cache duration and we have data
        const isStale = Date.now() - lastFetchedRef.current > CACHE_DURATION;
        const hasData = recentPhotos.length > 0;

        if (!hasData || isStale) {
          await fetchRecentPhotos(false);
          await fetchTrendingPhotos();
          if (isActive) lastFetchedRef.current = Date.now();
        }
      };

      loadData();

      // Keep the interval for "live" feel if staying on the screen
      const interval = setInterval(() => {
        if (isActive) {
          fetchRecentPhotos(false);
          fetchTrendingPhotos();
          lastFetchedRef.current = Date.now();
        }
      }, 30000);

      return () => {
        isActive = false;
        clearInterval(interval);
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


  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good Morning';
    if (hour < 17) return '🌤️ Good Afternoon';
    return '🌙 Good Evening';
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Animated.View style={headerScaleStyle}>
        <LinearGradient
          colors={["#00BFFF", "#1E90FF"]}
          style={[styles.header, { paddingTop: insets.top + 16, paddingBottom: 45 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Anti-flat Texture Overlay */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.03)', opacity: 0.5 }]} />

          {/* Luxury Shimmer Effect */}
          <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.15)", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.headerContent}>
            <Animated.View style={[styles.logoContainer, logoPulseStyle]}>
              <Image source={{ uri: LOGO_PHOTO }} style={styles.headerLogo} contentFit="contain" />
            </Animated.View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.headerGreeting}>{getGreeting()}</Text>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                College Gallery
              </Text>
              <Text
                style={styles.headerSubtitle}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Capture & Share Memories
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsSettingsVisible(true)}
              style={{ padding: 10 }}
            >
              <Ionicons name="settings-outline" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.sparkles}>✨</Text>
          </View>

          <View style={styles.headerRim} />
        </LinearGradient>
      </Animated.View>

      <Animated.FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.type}
        onScroll={mainScrollHandler}
        scrollEventThrottle={4}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        getItemLayout={getItemLayout}
        initialNumToRender={7}
        maxToRenderPerBatch={5}
        windowSize={15}
        updateCellsBatchingPeriod={30}
        removeClippedSubviews={false}
        overScrollMode="never"
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      />

      {/* Premium Photo Viewer */}
      <PhotoViewer
        visible={viewerOpen && isFocused}
        photos={viewerPhotos}
        startIndex={viewerIndex}
        currentUser={user}
        onClose={() => setViewerOpen(false)}
        onSwipe={(index: number) => {
          setViewerIndex(index);
          const p = viewerPhotos[index];
          if (p) incrementView(p._id);
        }}
        onLikeToggle={(id, isLiked, count) => {
          // Update the localized pool in the viewer
          setViewerPhotos(prev => prev.map(p => {
            if (p._id === id) {
              const newLikes = isLiked
                ? [...(p.likes || []), user?._id]
                : (p.likes || []).filter((uid: string) => uid !== user?._id);
              return { ...p, likes: newLikes };
            }
            return p;
          }));

          // Sync back to main pools to ensure Home reflects heart status
          const syncPool = (prev: any[]) => prev.map(p => {
            if (p._id === id) {
              const newLikes = isLiked
                ? [...(p.likes || []), user?._id]
                : (p.likes || []).filter((uid: string) => uid !== user?._id);
              return { ...p, likes: newLikes };
            }
            return p;
          });
          setRecentPhotos(syncPool);
          setTrendingPhotos(syncPool);
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
    backgroundColor: "transparent",
  },
  header: {
    paddingHorizontal: 25,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    // Layered Shadow for Premium Depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 10,
  },
  headerRim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    // Refined Shadow for Depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLogo: {
    width: '85%',
    height: '85%',
  },
  headerGreeting: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 33,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 2,
  },
  sparkles: {
    fontSize: 33,
  },
  statsWrapper: {
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,122,255,0.08)',
    // Sculpted Depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
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
    marginTop: 15,
  },
  featureCard: {
    backgroundColor: '#fff',
    width: (width - 60) / 2,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    // Beveled Detail
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    // Premium Depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
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
    borderWidth: 1.5,
    borderColor: '#E8F2FF',
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
    marginTop: 25,
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
  sectionIconComponent: {
    marginRight: 10,
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
    width: '140%',
    height: '100%',
    marginLeft: '-20%',
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
    padding: 16, // Slightly tighter padding for premium feel
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.03)', // Fallback, will be overridden
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
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
    marginTop: 15,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
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
  // News Style Trending Styles
  trendingSection: {
    // Height and Margins now handled by item container for zero-clipping
  },
  trendingTickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  tickerBadge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tickerBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  tickerContent: {
    flex: 1,
    paddingHorizontal: 15,
  },
  tickerText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trendingNewsCardContainer: {
    width: '100%',
    height: 200,
    marginBottom: 15,
  },
  viralGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    zIndex: -1,
    backgroundColor: '#FF3B3010',
  },
  trendingNewsCard: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  trendingNewsImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  trendingNewsOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.1)', // Subtle tint for consistency
  },
  trendingBadgeRow: {
    flexDirection: 'row',
  },
  newsBadgeBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 1,
  },
  newsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  trendingBadge: {
    backgroundColor: 'rgba(255,149,0,0.85)',
  },
  viralBadge: {
    backgroundColor: 'rgba(255,59,48,0.85)',
  },
  newsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  trendingNewsContent: {
    width: '100%',
  },
  trendingNewsHeadline: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
  },
  trendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  newsStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  newsStatIconBg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  newsStatValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    marginRight: 4,
  },
  newsStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  newsStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 12,
  },
});
