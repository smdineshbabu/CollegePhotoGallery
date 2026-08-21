import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StatusBar,
    Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import * as authService from "../services/authService";
import * as authStorage from "../services/authStorage";
import api from "../services/api";
import PhotoViewer from "../components/PhotoViewer";

const { width } = Dimensions.get("window");

type Photo = {
    _id: string;
    title: string;
    imageUrl: string;
    thumbnailUrl?: string;
    folder: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
};

export default function MyMemoriesScreen() {
    const router = useRouter();
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [myUploadsIds, setMyUploadsIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Viewer State
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);

    const fetchPhotos = async () => {
        try {
            setLoading(true);

            // Load local IDs only as a fallback or for shadow tracking
            const stored = await AsyncStorage.getItem("my_uploads");
            const localIds = stored ? JSON.parse(stored) : [];

            // Fetch from server (Now returns ONLY this user's photos)
            const response = await api.get("/upload/my");

            const storedUrl = await authStorage.getServerUrl();
            let baseRaw = (storedUrl || api.defaults.baseURL || "http://10.73.154.112:5000/api");
            if (!baseRaw.startsWith("http")) baseRaw = "http://" + baseRaw;
            const baseApiUrl = baseRaw.replace("/api", "").replace(/\/$/, "");

            const myPhotos = response.data.map((p: any) => {
                const fixUrl = (url: string) => {
                    if (!url) return null;
                    if (url.startsWith("/uploads")) return `${baseApiUrl}${url}`.trim();
                    if (url.startsWith("http")) {
                        const parts = url.split("/uploads/");
                        if (parts.length > 1) return `${baseApiUrl}/uploads/${parts[1]}`.trim();
                    }
                    return url.trim();
                };

                return {
                    ...p,
                    imageUrl: fixUrl(p.imageUrl) || p.imageUrl,
                    thumbnailUrl: fixUrl(p.thumbnailUrl) || p.thumbnailUrl || fixUrl(p.imageUrl),
                };
            });

            setPhotos(myPhotos);

        } catch (error: any) {
            console.error("Error fetching memories:", error);
            Alert.alert("Error", "Failed to load your memories.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPhotos();
    }, []);

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    const onRefresh = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRefreshing(true);
        fetchPhotos();
    }, []);

    const renderItem = ({ item, index }: { item: Photo; index: number }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            activeOpacity={0.7}
            onPress={() => {
                setViewerIndex(index);
                setViewerOpen(true);
            }}
        >
            <Image
                source={{ uri: item.thumbnailUrl || item.imageUrl }}
                style={styles.thumbnail}
                contentFit="cover"
                transition={200}
            />
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title || "Untitled"}</Text>
                <View style={styles.statusRow}>
                    <View style={[
                        styles.statusBadge,
                        item.status === 'approved' ? styles.statusApproved :
                            item.status === 'rejected' ? styles.statusRejected : styles.statusPending
                    ]}>
                        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.folderText}>{item.folder || "Uncategorized"}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <LinearGradient
                    colors={["#000000", "#1a1a1a"]}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Memories</Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <FlatList
                data={photos}
                renderItem={renderItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="cloud-upload-outline" size={64} color="rgba(255,255,255,0.3)" />
                            <Text style={styles.emptyTitle}>No Memories Yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Photos you upload will appear here so you can track their status.
                            </Text>
                        </View>
                    ) : null
                }
            />

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}

            <PhotoViewer
                visible={viewerOpen}
                photos={photos}
                startIndex={viewerIndex}
                onClose={() => setViewerOpen(false)}
                onSwipe={(index) => setViewerIndex(index)}
                onRename={async (id, newTitle) => {
                    await api.patch(`/upload/${id}`, { title: newTitle });
                    setPhotos(prev => prev.map(p => p._id === id ? { ...p, title: newTitle } : p));
                }}
                onDelete={async (id) => {
                    await api.delete(`/upload/${id}`);
                    setPhotos(prev => prev.filter(p => p._id !== id));
                    // Update local storage too
                    const stored = await AsyncStorage.getItem("my_uploads");
                    if (stored) {
                        const ids = JSON.parse(stored);
                        const filtered = ids.filter((pId: string) => pId !== id);
                        await AsyncStorage.setItem("my_uploads", JSON.stringify(filtered));
                    }
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#333',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 16,
        marginRight: 8,
    },
    itemTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 8,
    },
    statusApproved: { backgroundColor: '#4CD964' },
    statusRejected: { backgroundColor: '#FF3B30' },
    statusPending: { backgroundColor: '#FF9500' },
    statusText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    folderText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
    },
    emptySubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
