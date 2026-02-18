import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Alert,
    RefreshControl,
    StatusBar,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    ScrollView
} from "react-native";
import { useState, useCallback, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import api from "../../services/api";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authStorage from "../../services/authStorage";

const { width } = Dimensions.get("window");

export default function RequestsScreen() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [type, setType] = useState<'deletion' | 'general'>('general');

    const [allPhotos, setAllPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
    const [showPhotoPicker, setShowPhotoPicker] = useState(false);

    const fetchRequests = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const response = await api.get("/requests/my");

            const serverUrl = await authStorage.getServerUrl();
            let baseRaw = (serverUrl || api.defaults.baseURL || "http://10.73.154.112:5000/api");
            if (!baseRaw.startsWith("http")) baseRaw = "http://" + baseRaw;
            const baseApiUrl = baseRaw.replace("/api", "").replace(/\/$/, "");

            const items = response.data.map((req: any) => {
                if (req.photo && req.photo.imageUrl && req.photo.imageUrl.startsWith("/uploads")) {
                    return {
                        ...req,
                        photo: {
                            ...req.photo,
                            imageUrl: `${baseApiUrl}${req.photo.imageUrl}`
                        }
                    };
                }
                return req;
            });
            setRequests(items);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAllPhotos = async () => {
        try {
            const response = await api.get("/upload");

            const serverUrl = await authStorage.getServerUrl();
            let baseRaw = (serverUrl || api.defaults.baseURL || "http://10.73.154.112:5000/api");
            if (!baseRaw.startsWith("http")) baseRaw = "http://" + baseRaw;
            const baseApiUrl = baseRaw.replace("/api", "").replace(/\/$/, "");

            const items = response.data
                .map((p: any) => ({
                    ...p,
                    imageUrl: (p.imageUrl && p.imageUrl.startsWith("/uploads"))
                        ? `${baseApiUrl}${p.imageUrl}`
                        : (p.imageUrl || "")
                }));
            setAllPhotos(items);
        } catch (error) {
            console.error("Error fetching all photos:", error);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchAllPhotos();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRequests(false);
        fetchAllPhotos();
    }, []);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert("Wait", "Please enter a message for the admin.");
            return;
        }

        try {
            setSubmitting(true);
            await api.post("/requests", {
                message,
                type,
                photoId: selectedPhoto?._id
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMessage("");
            setSelectedPhoto(null);
            setType('general');
            setModalVisible(false);
            fetchRequests();
            Alert.alert("Sent", "Your request has been sent to the admin.");
        } catch (error) {
            Alert.alert("Error", "Failed to send message.");
        } finally {
            setSubmitting(false);
        }
    };

    const togglePicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowPhotoPicker(!showPhotoPicker);
    };

    const selectPhoto = (photo: any) => {
        setSelectedPhoto(photo);
        setShowPhotoPicker(false);
        if (type === 'general' && !selectedPhoto) {
            setType('deletion'); // Default to deletion if a photo is picked
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.requestCard}>
            <View style={styles.cardHeader}>
                <View style={[styles.statusBadge,
                item.status === 'resolved' ? styles.statusResolved :
                    item.status === 'ignored' ? styles.statusIgnored : styles.statusPending
                ]}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            <View style={styles.typeTag}>
                <Ionicons
                    name={item.type === 'deletion' ? "trash-outline" : "chatbubble-outline"}
                    size={12}
                    color={item.type === 'deletion' ? "#FF6B6B" : "#007AFF"}
                />
                <Text style={[styles.typeText, { color: item.type === 'deletion' ? "#FF6B6B" : "#007AFF" }]}>
                    {item.type === 'deletion' ? "DELETION REQUEST" : "GENERAL QUERY"}
                </Text>
            </View>

            <View style={styles.messageRow}>
                <Text style={styles.userMessage}>{item.message}</Text>
            </View>

            {item.photo && (
                <View style={styles.photoRefernce}>
                    <Image source={{ uri: item.photo.imageUrl }} style={styles.refImage} />
                    <View style={styles.refInfo}>
                        <Text style={styles.refTitle} numberOfLines={1}>{item.photo.title}</Text>
                        <Text style={styles.refNote}>Referenced Photo</Text>
                    </View>
                </View>
            )}

            {item.adminResponse ? (
                <View style={styles.adminResponse}>
                    <LinearGradient colors={["#F0F7FF", "#E6F2FF"]} style={styles.responseGradient}>
                        <View style={styles.adminLine} />
                        <Text style={styles.adminLabel}>Admin Response</Text>
                        <Text style={styles.responseText}>{item.adminResponse}</Text>
                    </LinearGradient>
                </View>
            ) : item.status === 'pending' && (
                <View style={styles.pendingStatus}>
                    <ActivityIndicator size="small" color="#999" style={{ scaleX: 0.8, scaleY: 0.8 }} />
                    <Text style={styles.waitingText}>Waiting for admin review...</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient colors={["#007AFF", "#00C6FF"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerTitle}>Connect</Text>
                        <Text style={styles.headerSubtitle}>Support & Requests</Text>
                    </View>
                    <Ionicons name="help-circle-outline" size={32} color="rgba(255,255,255,0.6)" />
                </View>
            </LinearGradient>

            <FlatList
                data={requests}
                keyExtractor={item => item._id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyCircle}>
                                <Ionicons name="chatbubbles-outline" size={50} color="#007AFF" />
                            </View>
                            <Text style={styles.emptyTitle}>Start a Conversation</Text>
                            <Text style={styles.emptySubtitle}>Have a question or want to delete a photo? Message us!</Text>
                        </View>
                    ) : (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#007AFF" />
                        </View>
                    )
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setModalVisible(true);
                }}
            >
                <LinearGradient colors={["#007AFF", "#00C6FF"]} style={styles.fabGradient}>
                    <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardView}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>New Request</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close-circle" size={28} color="#ccc" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <Text style={styles.inputLabel}>Type of Request</Text>
                                <View style={styles.typeToggle}>
                                    <TouchableOpacity
                                        style={[styles.typeOption, type === 'general' && styles.typeActive]}
                                        onPress={() => setType('general')}
                                    >
                                        <Text style={[styles.typeOptionText, type === 'general' && styles.typeActiveText]}>General</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.typeOption, type === 'deletion' && styles.typeActive]}
                                        onPress={() => setType('deletion')}
                                    >
                                        <Text style={[styles.typeOptionText, type === 'deletion' && styles.typeActiveText]}>Deletion</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.inputLabel}>Referenced Photo (Optional)</Text>
                                <View style={styles.photoSelectContainer}>
                                    {selectedPhoto ? (
                                        <View style={styles.selectedPhotoPreview}>
                                            <Image source={{ uri: selectedPhoto.imageUrl }} style={styles.previewImg} />
                                            <View style={styles.previewInfo}>
                                                <Text style={styles.previewTitle} numberOfLines={1}>{selectedPhoto.title}</Text>
                                                <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                                                    <Text style={styles.removeText}>Change</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.pickPhotoBtn} onPress={togglePicker}>
                                            <Ionicons name="image-outline" size={24} color="#007AFF" />
                                            <Text style={styles.pickPhotoText}>Select from your uploads</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {showPhotoPicker && (
                                    <View style={styles.pickerGrid}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {allPhotos.map(p => (
                                                <TouchableOpacity key={p._id} onPress={() => selectPhoto(p)} style={styles.pickerItem}>
                                                    <Image source={{ uri: p.imageUrl }} style={styles.pickerImg} />
                                                </TouchableOpacity>
                                            ))}
                                            {allPhotos.length === 0 && (
                                                <Text style={styles.noPhotosText}>No uploads found</Text>
                                            )}
                                        </ScrollView>
                                    </View>
                                )}

                                <Text style={styles.inputLabel}>Message</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={type === 'deletion' ? "Reason for deletion..." : "Ask us anything..."}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    value={message}
                                    onChangeText={setMessage}
                                />

                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    style={styles.sendBtn}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.sendText}>Send to Admin</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F3F7FA" },
    header: { padding: 25, paddingTop: 60, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerTitle: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
    headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 16, fontWeight: "600" },
    listContent: { padding: 20, paddingBottom: 110 },

    requestCard: { backgroundColor: "#fff", borderRadius: 25, padding: 20, marginBottom: 18, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, elevation: 2, borderWidth: 1, borderColor: "rgba(0,0,0,0.02)" },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusPending: { backgroundColor: "#FFF7E6" },
    statusResolved: { backgroundColor: "#E6FFFA" },
    statusIgnored: { backgroundColor: "#F3F4F6" },
    statusText: { fontSize: 10, fontWeight: "900", color: "#444" },
    dateText: { fontSize: 12, color: "#BBB", fontWeight: "600" },

    typeTag: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 },
    typeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

    messageRow: { marginBottom: 12 },
    userMessage: { fontSize: 16, color: "#2C3E50", fontWeight: "600", lineHeight: 22 },

    photoRefernce: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FBFC", padding: 10, borderRadius: 15, borderStyle: "dashed", borderWidth: 1, borderColor: "#DDE3E9", gap: 12 },
    refImage: { width: 50, height: 50, borderRadius: 10 },
    refInfo: { flex: 1 },
    refTitle: { fontSize: 14, fontWeight: "700", color: "#455A64" },
    refNote: { fontSize: 11, color: "#90A4AE", marginTop: 2 },

    adminResponse: { marginTop: 18 },
    responseGradient: { padding: 15, borderRadius: 18, position: "relative" },
    adminLine: { position: "absolute", left: 0, top: 15, bottom: 15, width: 3, backgroundColor: "#007AFF", borderRadius: 2 },
    adminLabel: { fontSize: 11, fontWeight: "900", color: "#007AFF", textTransform: "uppercase", marginBottom: 6, marginLeft: 5 },
    responseText: { fontSize: 15, color: "#34495E", lineHeight: 22, fontWeight: "500", marginLeft: 5 },

    pendingStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 15, paddingLeft: 5 },
    waitingText: { fontSize: 13, color: "#90A4AE", fontWeight: "500" },

    fab: { position: "absolute", bottom: 100, right: 25, width: 65, height: 65, borderRadius: 32.5, shadowColor: "#007AFF", shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    fabGradient: { flex: 1, borderRadius: 32.5, justifyContent: "center", alignItems: "center" },

    emptyState: { alignItems: "center", marginTop: 120 },
    emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#E3F2FD", justifyContent: "center", alignItems: "center", marginBottom: 20 },
    emptyTitle: { fontSize: 22, fontWeight: "900", color: "#2C3E50" },
    emptySubtitle: { color: "#90A4AE", fontSize: 15, textAlign: "center", paddingHorizontal: 50, marginTop: 10, lineHeight: 20 },
    loadingContainer: { marginTop: 100, alignItems: "center" },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },
    keyboardView: { flex: 1, justifyContent: "flex-end" },
    modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: "90%", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
    modalTitle: { fontSize: 24, fontWeight: "900", color: "#2C3E50" },

    inputLabel: { fontSize: 14, fontWeight: "800", color: "#90A4AE", textTransform: "uppercase", marginBottom: 10, marginTop: 5 },
    typeToggle: { flexDirection: "row", backgroundColor: "#F0F3F6", borderRadius: 15, padding: 5, marginBottom: 20 },
    typeOption: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12 },
    typeActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    typeOptionText: { fontSize: 15, fontWeight: "700", color: "#90A4AE" },
    typeActiveText: { color: "#007AFF" },

    photoSelectContainer: { marginBottom: 20 },
    pickPhotoBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F7FF", padding: 15, borderRadius: 15, borderStyle: "dashed", borderWidth: 1, borderColor: "#007AFF", gap: 12 },
    pickPhotoText: { color: "#007AFF", fontWeight: "700", fontSize: 15 },
    selectedPhotoPreview: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 18, gap: 15 },
    previewImg: { width: 60, height: 60, borderRadius: 12 },
    previewInfo: { flex: 1 },
    previewTitle: { fontSize: 16, fontWeight: "700", color: "#2C3E50" },
    removeText: { color: "#FF6B6B", fontWeight: "800", marginTop: 5, fontSize: 13 },

    pickerGrid: { marginBottom: 20, paddingVertical: 5 },
    pickerItem: { marginRight: 12 },
    pickerImg: { width: 80, height: 80, borderRadius: 15 },
    noPhotosText: { color: "#999", fontStyle: "italic", padding: 10 },

    input: { backgroundColor: "#F0F3F6", borderRadius: 20, padding: 18, minHeight: 120, fontSize: 16, color: "#2C3E50", fontWeight: "500", marginBottom: 25 },
    sendBtn: { backgroundColor: "#007AFF", padding: 20, borderRadius: 20, alignItems: "center", shadowColor: "#007AFF", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5, marginBottom: 20 },
    sendText: { color: "#fff", fontSize: 17, fontWeight: "900" }
});
