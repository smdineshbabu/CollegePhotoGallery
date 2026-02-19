import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    ActivityIndicator,
    Platform,
    useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
    FadeInDown,
    FadeInRight,
    useAnimatedStyle,
    withSpring,
    withTiming,
    useSharedValue,
    withRepeat,
    Easing,
    useAnimatedScrollHandler,
    useDerivedValue,
    useAnimatedSensor,
    SensorType,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import api from "../../services/api";

const { width, height } = Dimensions.get("window");

// --- REFINED LIQUID UI UTILS ---

const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const base = api.defaults.baseURL?.replace("/api", "") || "";
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

const getCircleConfig = (width: number, height: number) => {
    const configs = [];
    const colors = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];
    for (let i = 0; i < 35; i++) {
        configs.push({
            color: colors[i % colors.length],
            size: 60 + Math.random() * 60,
            top: Math.random() * height,
            left: Math.random() * width,
            phase: Math.random() * Math.PI * 2,
        });
    }
    return configs;
};

// Constants for Zero-Measurement Layout (Strict heights for ultra-smoothness)
const ITEM_HEIGHTS = {
    summary: 160,
    header: 110,
    folder: 100,
    photo: 100,
    spacer: 25
};

const LiquidCircle = memo(({ circle, time, sensorX, sensorY, agitation, width, height }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
        // 1. AMBIENT SWAY
        const swayX = Math.sin(time.value + circle.phase) * 40;
        const swayY = Math.cos(time.value + circle.phase) * 50;

        // 2. SLOSH PHYSICS
        const sloshX = sensorX.value * 120;
        const sloshY = sensorY.value * 120;

        // 3. SCALE
        const ambientScale = 1 + Math.sin(time.value + circle.phase) * 0.15;
        const finalScale = ambientScale * agitation.value;

        // 4. WRAP LOGIC
        const startX = circle.left || 0;
        const startY = circle.top || 0;

        let absX = (startX + swayX + sloshX + width) % width;
        let absY = (startY + swayY + sloshY + height) % height;

        return {
            left: absX,
            top: absY,
            transform: [
                { scale: finalScale }
            ]
        };
    });

    return (
        <Animated.View
            style={[
                styles.bgCircle,
                {
                    backgroundColor: circle.color,
                    width: circle.size,
                    height: circle.size,
                    borderRadius: circle.size / 2,
                    opacity: 0.6,
                    position: 'absolute',
                },
                animatedStyle
            ]}
        />
    );
});

const LiquidBackground = memo(({ scrollY }: any) => {
    const { width, height } = useWindowDimensions();
    const time = useSharedValue(0);
    const circleConfig = useMemo(() => getCircleConfig(width, height), [width, height]);

    // GRAVITY SENSOR
    const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 16 });

    // SMOOTH SENSOR DATA
    const sensorX = useDerivedValue(() => withSpring(sensor.sensor.value.x, { damping: 20, stiffness: 100 }));
    const sensorY = useDerivedValue(() => withSpring(sensor.sensor.value.y, { damping: 20, stiffness: 100 }));

    const agitation = useDerivedValue(() => {
        const totalMove = Math.abs(sensor.sensor.value.x) + Math.abs(sensor.sensor.value.y);
        return withSpring(
            interpolate(totalMove, [0, 15], [1, 1.4], Extrapolate.CLAMP),
            { damping: 10, stiffness: 60 }
        );
    });

    useEffect(() => {
        time.value = withRepeat(
            withTiming(2 * Math.PI, { duration: 5000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const smoothScrollY = useDerivedValue(() => {
        return withSpring(scrollY.value, { damping: 20, stiffness: 120 });
    });

    const parallax = useAnimatedStyle(() => ({
        transform: [{ translateY: -(smoothScrollY.value * 0.1) }]
    }));

    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, parallax]}>
            {circleConfig.map((circle, i) => (
                <LiquidCircle
                    key={i}
                    circle={circle}
                    time={time}
                    sensorX={sensorX}
                    sensorY={sensorY}
                    agitation={agitation}
                    width={width}
                    height={height}
                />
            ))}
            <BlurView intensity={15} style={StyleSheet.absoluteFill} tint="light" />
        </Animated.View>
    );
});

const InternalLiquidBackground = memo(({ swayValue }: any) => {
    const s1 = useAnimatedStyle(() => ({
        transform: [
            { translateX: Math.sin(swayValue.value * Math.PI) * 40 },
            { translateY: Math.cos(swayValue.value * Math.PI) * 20 },
            { scale: 1.2 + Math.sin(swayValue.value * Math.PI) * 0.3 }
        ]
    }));

    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 28 }]}>
            <Animated.View style={[styles.blob, { backgroundColor: 'rgba(0,122,255,0.08)', width: 250, height: 250, top: -60, right: -60 }, s1]} />
        </View>
    );
});

const LiquidSectionHeader = memo(({ title, isStats = false, swayValue }: any) => {
    return (
        <View style={styles.sectionHeaderContainer}>
            {isStats && <InternalLiquidBackground swayValue={swayValue} />}
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
});

const LiquidFolderRow = memo(({ folder, totalViews, flowShared }: any) => {
    const shimmerStyle = useAnimatedStyle(() => {
        'worklet';
        return {
            transform: [{ translateX: flowShared.value * 300 - 100 }],
        };
    });

    return (
        <View style={styles.folderRowItem}>
            <View style={styles.folderInfo}>
                <Text style={styles.folderName}>{folder.name}</Text>
                <Text style={styles.folderValue}>{folder.views} views</Text>
            </View>
            <View style={styles.progressBg}>
                <View
                    style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (folder.views / (totalViews || 1)) * 100)}%` }
                    ]}
                >
                    <Animated.View style={[styles.shimmerBox, shimmerStyle]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>
            </View>
        </View>
    );
});

const LiquidPhotoRow = memo(({ photo, index, floatingShared, pulseShared }: any) => {
    const animatedRank = useAnimatedStyle(() => ({
        transform: [{ translateY: floatingShared.value * 8 }],
    }));

    const animatedPulse = useAnimatedStyle(() => ({
        transform: [{ scale: pulseShared.value }],
    }));

    return (
        <View style={styles.photoRowItem}>
            <Animated.View style={[styles.rankBadge, animatedRank]}>
                <Text style={styles.rankText}>{index + 1}</Text>
            </Animated.View>
            <View style={styles.circularClip}>
                <Animated.View style={[StyleSheet.absoluteFill, animatedPulse]}>
                    <Image
                        source={{
                            uri: getImageUrl(photo.imageUrl),
                            headers: { "bypass-tunnel-reminder": "true" }
                        }}
                        style={styles.photoThumbCircular}
                        contentFit="cover"
                        transition={300}
                        cachePolicy="memory-disk"
                    />
                </Animated.View>
            </View>
            <View style={styles.photoInfo}>
                <Text style={styles.photoTitle} numberOfLines={1}>{photo.title || 'Untitled'}</Text>
                <Text style={styles.photoSubtitle}>{photo.folder || 'Gallery'}</Text>
            </View>
            <View style={styles.photoStats}>
                <Text style={styles.photoViews}>{photo.views || 0}</Text>
                <Text style={styles.photoViewsLabel}>Views</Text>
            </View>
        </View>
    );
});

export default function AnalyticsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [lastFetched, setLastFetched] = useState<number>(0);
    const CACHE_DURATION = 5 * 60 * 1000;

    const scrollY = useSharedValue(0);
    const scrollVelocity = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
            scrollVelocity.value = event.velocity?.y || 0;
        },
        onMomentumEnd: () => {
            scrollVelocity.value = withSpring(0);
        }
    });

    const fetchAnalytics = async (force = false) => {
        if (!force && analytics && (Date.now() - lastFetched < CACHE_DURATION)) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.get("/analytics", { timeout: 10000 });
            setAnalytics(response.data);
            setLastFetched(Date.now());
            setError(null);
        } catch (err: any) {
            console.error("Fetch analytics error:", err);
            setError("Failed to load analytics");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const floatingValue = useSharedValue(0);
    const pulseValue = useSharedValue(1);
    const flowValue = useSharedValue(0);
    const swayValue = useSharedValue(0);

    useEffect(() => {
        if (isFocused) {
            fetchAnalytics();
            floatingValue.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
            pulseValue.value = withRepeat(withTiming(1.05, { duration: 2500, easing: Easing.inOut(Easing.sin) }), -1, true);
            flowValue.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false);
            swayValue.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }), -1, true);
        }
    }, [isFocused]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAnalytics(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [analytics, lastFetched]);

    const listData = useMemo(() => {
        if (!analytics) return [];
        const items = [];
        items.push({ type: 'summary' });
        items.push({ type: 'header', title: 'Engagement by Folder', isStats: true });
        analytics.viewsByFolder?.forEach((folder: any, index: number) => {
            items.push({ type: 'folder', folder, index });
        });
        items.push({ type: 'spacer' });
        items.push({ type: 'header', title: 'Top Memories' });
        analytics.topPhotos?.forEach((photo: any, index: number) => {
            items.push({ type: 'photo', photo, index });
        });
        return items;
    }, [analytics]);

    const renderItem = useCallback(({ item }: any) => {
        switch (item.type) {
            case 'summary':
                return (
                    <View style={[styles.statsGrid, { height: ITEM_HEIGHTS.summary - 25 }]}>
                        <View style={styles.statCard}>
                            <LinearGradient colors={["#007AFF", "#00C6FF"]} style={styles.statGradient} />
                            <Ionicons name="trending-up" size={20} color="#fff" />
                            <Text style={styles.statValue}>{analytics?.summary?.totalViews || 0}</Text>
                            <Text style={styles.statLabel}>Total Views</Text>
                        </View>
                        <View style={styles.statCard}>
                            <LinearGradient colors={["#FF9500", "#FFCC00"]} style={styles.statGradient} />
                            <Ionicons name="image" size={20} color="#fff" />
                            <Text style={styles.statValue}>{analytics?.summary?.totalPhotos || 0}</Text>
                            <Text style={styles.statLabel}>Total Photos</Text>
                        </View>
                    </View>
                );
            case 'header':
                return <LiquidSectionHeader title={item.title} isStats={item.isStats} swayValue={swayValue} />;
            case 'folder':
                return (
                    <LiquidFolderRow
                        folder={item.folder}
                        totalViews={analytics?.summary?.totalViews}
                        flowShared={flowValue}
                    />
                );
            case 'photo':
                return (
                    <LiquidPhotoRow
                        photo={item.photo}
                        index={item.index}
                        floatingShared={floatingValue}
                        pulseShared={pulseValue}
                    />
                );
            case 'spacer':
                return <View style={{ height: ITEM_HEIGHTS.spacer }} />;
            default:
                return null;
        }
    }, [analytics, floatingValue, pulseValue, flowValue, swayValue]);

    const getItemLayout = useCallback((data: any, index: number) => {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            const type = data[i].type as keyof typeof ITEM_HEIGHTS;
            offset += ITEM_HEIGHTS[type];
        }
        const currentType = data[index].type as keyof typeof ITEM_HEIGHTS;
        return {
            length: ITEM_HEIGHTS[currentType],
            offset: offset,
            index,
        };
    }, []);

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <LiquidBackground scrollY={scrollY} />
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LiquidBackground scrollY={scrollY} />
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <Text style={styles.headerTitle}>Analytics</Text>
                <Text style={styles.headerSubtitle}>Gallery engagement & insights</Text>
            </View>
            <Animated.FlatList
                data={listData}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.type}-${index}`}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
                removeClippedSubviews={true}
                initialNumToRender={10}
                maxToRenderPerBatch={2}
                windowSize={5}
                updateCellsBatchingPeriod={100}
                getItemLayout={getItemLayout}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
                }
                ListEmptyComponent={error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAnalytics(true)}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "transparent",
    },
    blob: {
        position: 'absolute',
        borderRadius: 250,
        opacity: 0.5,
    },
    bgCircle: {
        position: 'absolute',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#fff',
    },
    header: {
        paddingHorizontal: 25,
        paddingBottom: 20,
        backgroundColor: "rgba(255,255,255,0.7)",
        overflow: 'hidden',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: "900",
        color: "#1a1a1a",
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 16,
        color: "#8E8E93",
        marginTop: 4,
        fontWeight: "500",
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingTop: 10,
    },
    statsGrid: {
        flexDirection: "row",
        gap: 15,
        marginBottom: 25,
    },
    statCard: {
        flex: 1,
        padding: 20,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.85)",
        overflow: "hidden",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    statGradient: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.9,
    },
    statValue: {
        fontSize: 28,
        fontWeight: "800",
        color: "#fff",
        marginTop: 10,
    },
    statLabel: {
        fontSize: 14,
        color: "rgba(255,255,255,0.8)",
        fontWeight: "600",
        marginTop: 2,
    },
    sectionHeaderContainer: {
        height: ITEM_HEIGHTS.header - 25,
        marginTop: 10,
        marginBottom: 15,
        paddingHorizontal: 20,
        paddingVertical: 15, // Reduced vertical padding to prevent clipping
        backgroundColor: "rgba(255,255,255,0.8)",
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1a1a1a",
        zIndex: 1,
    },
    folderRowItem: {
        height: ITEM_HEIGHTS.folder - 15,
        marginBottom: 15,
        backgroundColor: "rgba(255,255,255,0.85)",
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.6)",
        justifyContent: 'center',
    },
    folderInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    folderName: {
        fontSize: 15,
        fontWeight: "700",
        color: "#4a4a4a",
    },
    folderValue: {
        fontSize: 13,
        color: "#8E8E93",
        fontWeight: "600",
    },
    progressBg: {
        height: 10,
        backgroundColor: "rgba(0,0,0,0.05)",
        borderRadius: 5,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#007AFF",
        borderRadius: 5,
        overflow: 'hidden',
    },
    shimmerBox: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 120,
    },
    photoRowItem: {
        height: ITEM_HEIGHTS.photo - 15,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 15,
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: 12,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.8)",
        elevation: 2,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#007AFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    rankText: {
        fontSize: 12,
        fontWeight: "900",
        color: "#fff",
    },
    circularClip: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: "hidden",
        marginRight: 14,
        borderWidth: 2,
        borderColor: "#fff",
        backgroundColor: "#f0f2f5",
    },
    photoThumbCircular: {
        width: '100%',
        height: '100%',
    },
    photoInfo: {
        flex: 1,
    },
    photoTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: "#1a1a1a",
    },
    photoSubtitle: {
        fontSize: 12,
        color: "#8E8E93",
        marginTop: 1,
        fontWeight: "500",
    },
    photoStats: {
        alignItems: "flex-end",
    },
    photoViews: {
        fontSize: 16,
        fontWeight: "900",
        color: "#007AFF",
    },
    photoViewsLabel: {
        fontSize: 9,
        color: "#8E8E93",
        fontWeight: "700",
        textTransform: "uppercase",
    },
    errorContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    errorText: {
        fontSize: 16,
        color: "#FF3B30",
        fontWeight: "600",
        marginTop: 10,
        textAlign: "center",
    },
    retryBtn: {
        marginTop: 20,
        backgroundColor: "#007AFF",
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 15,
    },
    retryText: {
        color: "#fff",
        fontWeight: "700",
    },
});
