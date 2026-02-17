import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Dimensions,
    TouchableOpacity,
    FlatList,
    StatusBar,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideInUp,
    SlideOutDown,
    FadeInUp,
    FadeOutUp,
    FadeInDown,
    ZoomIn,
    ZoomOut,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────
interface Photo {
    _id: string;
    title: string;
    imageUrl: string;
    folder?: string;
    [key: string]: any;
}

interface PhotoViewerProps {
    visible: boolean;
    photos: Photo[];
    startIndex: number;
    onClose: () => void;
    onRename?: (id: string, newTitle: string) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onSwipe?: (index: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────
export default function PhotoViewer({
    visible,
    photos,
    startIndex,
    onClose,
    onRename,
    onDelete,
    onSwipe,
}: PhotoViewerProps) {
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);

    const [idx, setIdx] = useState(startIndex);
    const [renaming, setRenaming] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);

    // Sync index on open
    useEffect(() => {
        if (visible) {
            setIdx(startIndex);
            setRenaming(false);
            setTitleDraft("");
            setBusy(false);
            setControlsVisible(true);
        }
    }, [visible, startIndex]);

    const photo = photos[idx];

    // ─── Handlers ────────────────────────────────────────────────────
    const onScroll = useCallback(
        (e: any) => {
            const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            if (newIdx !== idx && newIdx >= 0 && newIdx < photos.length) {
                setIdx(newIdx);
                setRenaming(false);
                onSwipe?.(newIdx);
                Haptics.selectionAsync();
            }
        },
        [idx, photos.length, onSwipe]
    );

    const toggleControls = () => {
        if (!renaming) {
            setControlsVisible((v) => !v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const beginRename = () => {
        if (!photo) return;
        setTitleDraft(photo.title || "");
        setRenaming(true);
        setControlsVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const cancelRename = () => {
        setRenaming(false);
        setTitleDraft("");
    };

    const submitRename = async () => {
        if (!titleDraft.trim()) {
            Alert.alert("Oops", "Title can't be empty");
            return;
        }
        if (!onRename || !photo) return;
        try {
            setBusy(true);
            await onRename(photo._id, titleDraft.trim());
            setRenaming(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
            Alert.alert("Error", "Could not rename. Try again.");
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = () => {
        if (!onDelete || !photo) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            "Delete Photo",
            "This memory will be permanently removed.",
            [
                { text: "Keep", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setBusy(true);
                            await onDelete(photo._id);
                            Haptics.notificationAsync(
                                Haptics.NotificationFeedbackType.Success
                            );
                            // If it was the last photo, close viewer
                            if (photos.length <= 1) {
                                onClose();
                            }
                        } catch {
                            Alert.alert("Error", "Could not delete.");
                        } finally {
                            setBusy(false);
                        }
                    },
                },
            ]
        );
    };

    // ─── Render each page ────────────────────────────────────────────
    const renderPage = useCallback(
        ({ item }: { item: Photo }) => (
            <TouchableOpacity
                activeOpacity={1}
                onPress={toggleControls}
                style={styles.page}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.zoomContent}
                    maximumZoomScale={4}
                    minimumZoomScale={1}
                    centerContent
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    bouncesZoom
                >
                    <Image
                        source={{
                            uri: item.imageUrl,
                            headers: { "bypass-tunnel-reminder": "true" },
                        }}
                        style={styles.image}
                        contentFit="contain"
                        transition={250}
                    />
                </ScrollView>
            </TouchableOpacity>
        ),
        [controlsVisible, renaming]
    );

    const getLayout = (_: any, i: number) => ({
        length: SCREEN_W,
        offset: SCREEN_W * i,
        index: i,
    });

    // ─── Main Return ─────────────────────────────────────────────────
    if (!visible) return null;
    if (photos.length === 0) return null;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.root}>
                <StatusBar hidden />

                {/* ═══ Image List ═══ */}
                <FlatList
                    ref={listRef}
                    data={photos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={startIndex}
                    getItemLayout={getLayout}
                    onMomentumScrollEnd={onScroll}
                    keyExtractor={(p) => p._id}
                    renderItem={renderPage}
                    windowSize={3}
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    removeClippedSubviews
                />

                {/* ═══ TOP CONTROLS ═══ */}
                {controlsVisible && !renaming && (
                    <Animated.View
                        entering={FadeInUp.duration(200)}
                        exiting={FadeOutUp.duration(150)}
                        style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}
                        pointerEvents="box-none"
                    >
                        <LinearGradient
                            colors={["rgba(0,0,0,0.7)", "transparent"]}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                        />

                        {/* ── Normal Top Bar ────────────────────────────── */}
                        <View style={styles.topRow}>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.circleBtn}
                                hitSlop={12}
                            >
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>

                            <View style={styles.counterPill}>
                                <Text style={styles.counterText}>
                                    {idx + 1}
                                    <Text style={{ fontWeight: "400", opacity: 0.6 }}>
                                        {" / "}
                                        {photos.length}
                                    </Text>
                                </Text>
                            </View>

                            {/* Spacer to balance layout */}
                            <View style={{ width: 44 }} />
                        </View>
                    </Animated.View>
                )}

                {/* ═══ BOTTOM CONTROLS ═══ */}
                {controlsVisible && !renaming && (
                    <Animated.View
                        entering={SlideInDown.duration(250)}
                        exiting={SlideOutDown.duration(200)}
                        style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 16 }]}
                        pointerEvents="box-none"
                    >
                        <LinearGradient
                            colors={["transparent", "rgba(0,0,0,0.85)"]}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                        />

                        {/* ── Normal Bottom ─────────────────────────────── */}
                        <View style={styles.bottomContent}>
                            {/* Title & Folder */}
                            <View style={styles.infoSection}>
                                <Text style={styles.photoTitle} numberOfLines={2}>
                                    {photo?.title || "Untitled"}
                                </Text>
                                <View style={styles.folderBadge}>
                                    <Ionicons name="folder-open" size={12} color="#00C6FF" />
                                    <Text style={styles.folderText}>
                                        {photo?.folder || "Memory"}
                                    </Text>
                                </View>
                                {photo?.status === 'rejected' && (
                                    <View style={styles.rejectionSection}>
                                        <Ionicons name="warning-outline" size={14} color="#FF6B6B" />
                                        <Text style={styles.rejectionTitle}>Admin Reason:</Text>
                                        <Text style={styles.rejectionReason} numberOfLines={3}>
                                            {photo?.rejectionReason || "No reason specified"}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.actionRow}>
                                {onRename && (
                                    <TouchableOpacity
                                        onPress={beginRename}
                                        style={styles.actionBtn}
                                        hitSlop={8}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: "rgba(0,198,255,0.2)" }]}>
                                            <Ionicons name="pencil" size={20} color="#00C6FF" />
                                        </View>
                                        <Text style={styles.actionLabel}>Rename</Text>
                                    </TouchableOpacity>
                                )}

                                {onDelete && (
                                    <TouchableOpacity
                                        onPress={confirmDelete}
                                        style={styles.actionBtn}
                                        hitSlop={8}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: "rgba(255,107,107,0.2)" }]}>
                                            <Ionicons name="trash" size={20} color="#FF6B6B" />
                                        </View>
                                        <Text style={styles.actionLabel}>Delete</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </Animated.View>
                )}

                {/* ═══ RENAME OVERLAY (Centered & High-Visibility) ═══ */}
                {renaming && (
                    <Animated.View
                        entering={FadeIn.duration(250)}
                        exiting={FadeOut.duration(200)}
                        style={styles.fullOverlay}
                    >
                        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={cancelRename}
                            style={StyleSheet.absoluteFill}
                        />

                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={styles.keyboardView}
                        >
                            <Animated.View
                                entering={FadeIn.duration(300)}
                                style={styles.renameCard}
                            >
                                <Text style={styles.renameModalTitle}>Rename Memory</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={styles.centeredInput}
                                        value={titleDraft}
                                        onChangeText={setTitleDraft}
                                        autoFocus
                                        placeholder="New title"
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        returnKeyType="done"
                                        onSubmitEditing={submitRename}
                                        selectionColor="#00C6FF"
                                    />
                                </View>

                                <View style={styles.renameButtonsRow}>
                                    <TouchableOpacity onPress={cancelRename} style={styles.renameBtnBase}>
                                        <Text style={styles.renameBtnCancel}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={submitRename}
                                        disabled={busy}
                                        style={[styles.renameBtnBase, styles.renameBtnSave]}
                                    >
                                        {busy ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.renameSaveText}>Save</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>
                        </KeyboardAvoidingView>
                    </Animated.View>
                )}

                {/* Saving overlay */}
                {busy && !renaming && (
                    <View style={styles.busyOverlay}>
                        <ActivityIndicator size="large" color="#00C6FF" />
                    </View>
                )}
            </View>
        </Modal>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#000",
    },

    // ─ Pages ─
    page: {
        width: SCREEN_W,
        height: SCREEN_H,
        backgroundColor: "#000",
    },
    zoomContent: {
        width: SCREEN_W,
        height: SCREEN_H,
        justifyContent: "center",
        alignItems: "center",
    },
    image: {
        width: SCREEN_W,
        height: SCREEN_H,
    },

    // ─ Top Overlay ─
    topOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    topTitle: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
        letterSpacing: 0.5,
    },

    // ─ Circle Button (Back) ─
    circleBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.15)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },

    // ─ Pill Button (Cancel / Save) ─
    pillBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    savePill: {
        backgroundColor: "#00C6FF",
        borderColor: "#00C6FF",
    },
    pillText: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 14,
        fontWeight: "600",
    },

    // ─ Counter ─
    counterPill: {
        paddingHorizontal: 18,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    counterText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
        letterSpacing: 0.8,
    },

    // ─ Bottom Overlay ─
    bottomOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingHorizontal: 20,
        paddingTop: 50,
    },
    bottomContent: {},

    // ─ Photo Info ─
    infoSection: {
        marginBottom: 16,
    },
    photoTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: -0.5,
        lineHeight: 30,
    },
    folderBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: "rgba(0,198,255,0.12)",
        borderRadius: 8,
        alignSelf: "flex-start",
    },
    folderText: {
        color: "#00C6FF",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    rejectionSection: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
        marginTop: 12,
        padding: 12,
        backgroundColor: "rgba(255,107,107,0.12)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,107,107,0.2)",
    },
    rejectionTitle: {
        color: "#FF6B6B",
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    rejectionReason: {
        flex: 1,
        color: "rgba(255,255,255,0.9)",
        fontSize: 13,
        fontWeight: "500",
        lineHeight: 18,
    },

    // ─ Action Buttons ─
    actionRow: {
        flexDirection: "row",
        gap: 12,
    },
    actionBtn: {
        alignItems: "center",
        gap: 4,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    actionLabel: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 11,
        fontWeight: "600",
    },

    // ─ Rename Overlay ─
    fullOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 200,
    },
    keyboardView: {
        width: "100%",
        paddingHorizontal: 24,
        alignItems: "center",
    },
    renameCard: {
        width: "100%",
        backgroundColor: "rgba(30,30,30,0.92)",
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
    },
    renameModalTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 20,
    },
    inputContainer: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        marginBottom: 24,
    },
    centeredInput: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        paddingVertical: 14,
        paddingHorizontal: 16,
        textAlign: "center",
    },
    renameButtonsRow: {
        flexDirection: "row",
        gap: 12,
    },
    renameBtnBase: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    renameBtnSave: {
        backgroundColor: "#00C6FF",
    },
    renameBtnCancel: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 16,
        fontWeight: "600",
    },
    renameSaveText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    // ─ Busy Overlay ─
    busyOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 300,
    },
});
