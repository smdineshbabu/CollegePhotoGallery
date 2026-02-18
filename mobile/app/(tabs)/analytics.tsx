import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    ActivityIndicator,
    Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";

const { width } = Dimensions.get("window");

export default function AnalyticsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const insets = useSafeAreaInsets();

    const fetchAnalytics = async () => {
        try {
            const response = await api.get("/analytics", { timeout: 5000 });
            setAnalytics(response.data);
            setError(null);
        } catch (err: any) {
            console.error("Fetch analytics error:", err);
            setError("Failed to load analytics");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAnalytics();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#f8f9fa", "#e9ecef"]}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <Text style={styles.headerTitle}>Analytics</Text>
                <Text style={styles.headerSubtitle}>Gallery engagement & insights</Text>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
                }
            >
                {error ? (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={fetchAnalytics}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <View style={styles.statsGrid}>
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

                        {/* Folder Engagement */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Engagement by Folder</Text>
                            {analytics?.viewsByFolder?.map((folder: any, index: number) => (
                                <View key={index} style={styles.folderRow}>
                                    <View style={styles.folderInfo}>
                                        <Text style={styles.folderName}>{folder.name}</Text>
                                        <Text style={styles.folderValue}>{folder.views} views</Text>
                                    </View>
                                    <View style={styles.progressBg}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                { width: `${Math.min(100, (folder.views / (analytics?.summary?.totalViews || 1)) * 400)}%` }
                                            ]}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Top Photos */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Top Memories</Text>
                            {analytics?.topPhotos?.map((photo: any, index: number) => (
                                <View key={photo._id} style={styles.photoRow}>
                                    <Text style={styles.rankText}>#{index + 1}</Text>
                                    <Image
                                        source={{ uri: photo.imageUrl }}
                                        style={styles.photoThumb}
                                        contentFit="cover"
                                    />
                                    <View style={styles.photoInfo}>
                                        <Text style={styles.photoTitle} numberOfLines={1}>{photo.title}</Text>
                                        <Text style={styles.photoSubtitle}>{photo.folder}</Text>
                                    </View>
                                    <View style={styles.photoStats}>
                                        <Text style={styles.photoViews}>{photo.views}</Text>
                                        <Text style={styles.photoViewsLabel}>Views</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        paddingHorizontal: 25,
        paddingBottom: 20,
        backgroundColor: "#fff",
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
        backgroundColor: "#fff",
        overflow: "hidden",
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
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
    section: {
        marginBottom: 30,
        padding: 24,
        backgroundColor: "#fff",
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1a1a1a",
        marginBottom: 20,
    },
    folderRow: {
        marginBottom: 15,
    },
    folderInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    folderName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#4a4a4a",
    },
    folderValue: {
        fontSize: 13,
        color: "#8E8E93",
        fontWeight: "500",
    },
    progressBg: {
        height: 8,
        backgroundColor: "#f0f2f5",
        borderRadius: 4,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#007AFF",
        borderRadius: 4,
    },
    photoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 15,
        backgroundColor: "#f8f9fa",
        padding: 12,
        borderRadius: 16,
    },
    rankText: {
        fontSize: 14,
        fontWeight: "800",
        color: "#007AFF",
        width: 25,
    },
    photoThumb: {
        width: 50,
        height: 50,
        borderRadius: 12,
        marginRight: 12,
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
        marginTop: 2,
    },
    photoStats: {
        alignItems: "flex-end",
    },
    photoViews: {
        fontSize: 16,
        fontWeight: "800",
        color: "#007AFF",
    },
    photoViewsLabel: {
        fontSize: 10,
        color: "#8E8E93",
        fontWeight: "600",
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
