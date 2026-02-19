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
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import * as authService from "../services/authService";
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
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    useSharedValue,
    useAnimatedStyle,
    FadeInUp,
    FadeOutUp,
    FadeInDown,
    ZoomIn,
    ZoomOut,
    interpolate,
    Extrapolation,
    Easing,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────────────────────
interface Photo {
    _id: string;
    title: string;
    imageUrl: string;
    folder?: string;
    status?: string;
    rejectionReason?: string;
    likes?: string[];
    [key: string]: any;
}

interface PhotoViewerProps {
    visible: boolean;
    photos: Photo[];
    startIndex: number;
    onClose: () => void;
    onSwipe?: (index: number) => void;
    currentUser?: any;
    onLikeToggle?: (id: string, isLiked: boolean, likesCount: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export default function PhotoViewer({
    visible,
    photos,
    startIndex,
    onClose,
    onSwipe,
    currentUser,
    onLikeToggle,
}: PhotoViewerProps) {
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList>(null);

    const [idx, setIdx] = useState(startIndex);
    const [busy, setBusy] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);

    const [requestModalVisible, setRequestModalVisible] = useState(false);
    const [requestMessage, setRequestMessage] = useState("");
    const [requestType, setRequestType] = useState<'deletion' | 'rename' | 'general'>('deletion');

    const photo = (photos && idx >= 0 && idx < photos.length) ? photos[idx] : null;

    // Like State
    const [localLikes, setLocalLikes] = useState<{ [id: string]: { count: number, isLiked: boolean } }>({});

    useEffect(() => {
        if (visible && photos.length > 0) {
            const initialLikes: any = {};
            photos.forEach(p => {
                initialLikes[p._id] = {
                    count: p.likes?.length || 0,
                    isLiked: p.likes?.includes(currentUser?._id) || false
                };
            });
            setLocalLikes(initialLikes);
        }
    }, [visible, photos, currentUser]);

    // Internal user reference to support fallback
    const [internalUser, setInternalUser] = useState<any>(currentUser);
    useEffect(() => {
        if (currentUser) setInternalUser(currentUser);
    }, [currentUser]);

    useEffect(() => {
        if (visible && !internalUser) {
            authService.getCurrentUser().then(user => {
                if (user) {
                    setInternalUser(user);
                    setLocalLikes(prev => {
                        const newLikes = { ...prev };
                        photos.forEach(p => {
                            newLikes[p._id] = {
                                count: p.likes?.length || 0,
                                isLiked: p.likes?.includes(user._id) || false
                            };
                        });
                        return newLikes;
                    });
                }
            });
        }
    }, [visible, internalUser]);

    // ─── Heart Animation Styles ──────────────────────────────────────
    const heartScale = useSharedValue(0);
    const heartOpacity = useSharedValue(0);
    const heartRotate = useSharedValue(0);
    const flashOpacity = useSharedValue(0);
    // 6 mini hearts
    const mini1X = useSharedValue(0); const mini1Y = useSharedValue(0); const mini1O = useSharedValue(0); const mini1S = useSharedValue(0);
    const mini2X = useSharedValue(0); const mini2Y = useSharedValue(0); const mini2O = useSharedValue(0); const mini2S = useSharedValue(0);
    const mini3X = useSharedValue(0); const mini3Y = useSharedValue(0); const mini3O = useSharedValue(0); const mini3S = useSharedValue(0);
    const mini4X = useSharedValue(0); const mini4Y = useSharedValue(0); const mini4O = useSharedValue(0); const mini4S = useSharedValue(0);
    const mini5X = useSharedValue(0); const mini5Y = useSharedValue(0); const mini5O = useSharedValue(0); const mini5S = useSharedValue(0);
    const mini6X = useSharedValue(0); const mini6Y = useSharedValue(0); const mini6O = useSharedValue(0); const mini6S = useSharedValue(0);

    // 8 particle dots
    const dot1X = useSharedValue(0); const dot1Y = useSharedValue(0); const dot1O = useSharedValue(0); const dot1S = useSharedValue(0);
    const dot2X = useSharedValue(0); const dot2Y = useSharedValue(0); const dot2O = useSharedValue(0); const dot2S = useSharedValue(0);
    const dot3X = useSharedValue(0); const dot3Y = useSharedValue(0); const dot3O = useSharedValue(0); const dot3S = useSharedValue(0);
    const dot4X = useSharedValue(0); const dot4Y = useSharedValue(0); const dot4O = useSharedValue(0); const dot4S = useSharedValue(0);
    const dot5X = useSharedValue(0); const dot5Y = useSharedValue(0); const dot5O = useSharedValue(0); const dot5S = useSharedValue(0);
    const dot6X = useSharedValue(0); const dot6Y = useSharedValue(0); const dot6O = useSharedValue(0); const dot6S = useSharedValue(0);
    const dot7X = useSharedValue(0); const dot7Y = useSharedValue(0); const dot7O = useSharedValue(0); const dot7S = useSharedValue(0);
    const dot8X = useSharedValue(0); const dot8Y = useSharedValue(0); const dot8O = useSharedValue(0); const dot8S = useSharedValue(0);

    const animatedHeartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }, { rotate: `${heartRotate.value}deg` }],
        opacity: heartOpacity.value,
    }));
    const animatedFlashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

    const makeDotStyle = (x: any, y: any, o: any, s: any) => useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
        opacity: o.value,
    }));

    const particleDots = [
        { style: makeDotStyle(dot1X, dot1Y, dot1O, dot1S), x: dot1X, y: dot1Y, o: dot1O, s: dot1S, dx: 110, dy: 0, color: '#FF3B30', size: 8 },
        { style: makeDotStyle(dot2X, dot2Y, dot2O, dot2S), x: dot2X, y: dot2Y, o: dot2O, s: dot2S, dx: 78, dy: -78, color: '#FF6B9D', size: 6 },
        { style: makeDotStyle(dot3X, dot3Y, dot3O, dot3S), x: dot3X, y: dot3Y, o: dot3O, s: dot3S, dx: 0, dy: -110, color: '#FF3B30', size: 8 },
        { style: makeDotStyle(dot4X, dot4Y, dot4O, dot4S), x: dot4X, y: dot4Y, o: dot4O, s: dot4S, dx: -78, dy: -78, color: '#FF6B9D', size: 6 },
        { style: makeDotStyle(dot5X, dot5Y, dot5O, dot5S), x: dot5X, y: dot5Y, o: dot5O, s: dot5S, dx: -110, dy: 0, color: '#FF3B30', size: 8 },
        { style: makeDotStyle(dot6X, dot6Y, dot6O, dot6S), x: dot6X, y: dot6Y, o: dot6O, s: dot6S, dx: -78, dy: 78, color: '#FF6B9D', size: 6 },
        { style: makeDotStyle(dot7X, dot7Y, dot7O, dot7S), x: dot7X, y: dot7Y, o: dot7O, s: dot7S, dx: 0, dy: 110, color: '#FF3B30', size: 8 },
        { style: makeDotStyle(dot8X, dot8Y, dot8O, dot8S), x: dot8X, y: dot8Y, o: dot8O, s: dot8S, dx: 78, dy: 78, color: '#FF6B9D', size: 6 },
    ];

    const makeMiniStyle = (x: any, y: any, o: any, s: any) => useAnimatedStyle(() => ({
        transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
        opacity: o.value,
    }));

    const miniHearts = [
        { style: makeMiniStyle(mini1X, mini1Y, mini1O, mini1S), x: mini1X, y: mini1Y, o: mini1O, s: mini1S, dx: -60, dy: -90, size: 22, color: '#FF3B30' },
        { style: makeMiniStyle(mini2X, mini2Y, mini2O, mini2S), x: mini2X, y: mini2Y, o: mini2O, s: mini2S, dx: 60, dy: -90, size: 18, color: '#FF6B9D' },
        { style: makeMiniStyle(mini3X, mini3Y, mini3O, mini3S), x: mini3X, y: mini3Y, o: mini3O, s: mini3S, dx: -90, dy: -40, size: 16, color: '#FF3B30' },
        { style: makeMiniStyle(mini4X, mini4Y, mini4O, mini4S), x: mini4X, y: mini4Y, o: mini4O, s: mini4S, dx: 90, dy: -40, size: 20, color: '#FF6B9D' },
        { style: makeMiniStyle(mini5X, mini5Y, mini5O, mini5S), x: mini5X, y: mini5Y, o: mini5O, s: mini5S, dx: -40, dy: -120, size: 14, color: '#FF3B30' },
        { style: makeMiniStyle(mini6X, mini6Y, mini6O, mini6S), x: mini6X, y: mini6Y, o: mini6O, s: mini6S, dx: 40, dy: -120, size: 12, color: '#FF6B9D' },
    ];

    const triggerHeartPop = useCallback(() => {
        'worklet';
        heartScale.value = 0; heartRotate.value = -12; heartOpacity.value = 1;
        heartScale.value = withSequence(
            withSpring(1.2, { damping: 8, stiffness: 400 }),   // Even smaller pop
            withSpring(1.0, { damping: 15, stiffness: 400 }),  // Snappier settle
            withDelay(250, withTiming(0, { duration: 300 }))
        );
        heartRotate.value = withSequence(
            withSpring(8, { damping: 7 }),
            withSpring(-4, { damping: 10 }),
            withSpring(0, { damping: 12 })
        );
        heartOpacity.value = withDelay(550, withTiming(0, { duration: 250 }));
        flashOpacity.value = 0.15; // Subtler flash
        flashOpacity.value = withSequence(withTiming(0.08, { duration: 100 }), withTiming(0, { duration: 250 }));

        particleDots.forEach(({ x, y, o, s, dx, dy }, i) => {
            const delay = i * 25;
            x.value = 0; y.value = 0; o.value = 0; s.value = 0;
            o.value = withDelay(delay, withTiming(1, { duration: 50 }));
            s.value = withDelay(delay, withSpring(0.8, { damping: 12, stiffness: 450 }));
            x.value = withDelay(delay, withSpring(dx * 0.4, { damping: 14, stiffness: 200 }));
            y.value = withDelay(delay, withSpring(dy * 0.4, { damping: 14, stiffness: 200 }));
            o.value = withDelay(delay + 200, withTiming(0, { duration: 250 }));
        });
        miniHearts.forEach(({ x, y, o, s, dx, dy }, i) => {
            const delay = i < 3 ? 0 : 100;
            x.value = 0; y.value = 0; o.value = 0; s.value = 0;
            o.value = withDelay(delay, withTiming(1, { duration: 70 }));
            s.value = withDelay(delay, withSpring(i < 3 ? 0.7 : 0.6, { damping: 14, stiffness: 400 }));
            x.value = withDelay(delay, withSpring(dx * 0.35, { damping: 16, stiffness: 220 }));
            y.value = withDelay(delay, withSpring(dy * 0.35, { damping: 16, stiffness: 220 }));
            o.value = withDelay(delay + 250, withTiming(0, { duration: 300 }));
        });
    }, [heartScale, heartRotate, heartOpacity, flashOpacity]);

    const toggleLike = useCallback(async (specificId?: string) => {
        const targetId = specificId || photo?._id;
        let activeUser = internalUser || currentUser;
        if (!activeUser) {
            try { activeUser = await authService.getCurrentUser(); if (activeUser) setInternalUser(activeUser); } catch (e) { }
        }
        if (!targetId || !activeUser) return;

        const currentPhotoLikes = localLikes[targetId] || { count: 0, isLiked: false };
        const newIsLiked = !currentPhotoLikes.isLiked;
        const newCount = newIsLiked ? currentPhotoLikes.count + 1 : currentPhotoLikes.count - 1;

        setLocalLikes(prev => ({ ...prev, [targetId]: { count: Math.max(0, newCount), isLiked: newIsLiked } }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const response = await api.patch(`/upload/${targetId}/like`);
            const { likesCount, isLiked } = response.data;
            setLocalLikes(prev => ({ ...prev, [targetId]: { count: likesCount, isLiked } }));
            onLikeToggle?.(targetId, isLiked, likesCount);
        } catch (err) {
            setLocalLikes(prev => ({ ...prev, [targetId]: currentPhotoLikes }));
        }
    }, [photo?._id, internalUser, currentUser, localLikes, onLikeToggle]);

    const submitRequest = async () => {
        if (!requestMessage.trim()) { Alert.alert("Error", "Please enter a reason/message."); return; }
        try {
            setBusy(true);
            await api.post("/requests", { photoId: photo?._id, message: requestMessage.trim(), type: requestType });
            setRequestModalVisible(false); setRequestMessage("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Request sent to admin.");
        } catch (err) { Alert.alert("Error", "Failed to send request."); }
        finally { setBusy(false); }
    };

    // Manual double-tap detector using refs
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef<any>(null);

    const onMainTap = useCallback((itemId: string) => {
        const now = Date.now();
        if (tapCountRef.current > 0 && (now - tapCountRef.current) < 300) {
            if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
            tapCountRef.current = 0;
            const currentLikes = localLikes[itemId];
            if (currentLikes?.isLiked) {
                triggerHeartPop();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                triggerHeartPop();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                toggleLike(itemId);
            }
        } else {
            tapCountRef.current = now;
            tapTimerRef.current = setTimeout(() => {
                tapCountRef.current = 0;
                setControlsVisible(v => !v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }, 200);
        }
    }, [localLikes, triggerHeartPop, toggleLike]);

    const onScroll = useCallback((e: any) => {
        const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
        if (newIdx !== idx && newIdx >= 0 && newIdx < photos.length) {
            setIdx(newIdx);
            onSwipe?.(newIdx);
            Haptics.selectionAsync();
        }
    }, [idx, photos.length, onSwipe]);

    const renderPage = useCallback(({ item }: { item: Photo }) => (
        <View style={styles.page}>
            <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={styles.zoomContent} maximumZoomScale={4} minimumZoomScale={1} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} bouncesZoom>
                <Image source={{ uri: item.imageUrl, headers: { "bypass-tunnel-reminder": "true" } }} style={styles.image} contentFit="contain" transition={250} />
            </ScrollView>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => onMainTap(item._id)} />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, animatedFlashStyle]} pointerEvents="none" />
            {particleDots.map((d, i) => (<Animated.View key={i} style={[styles.particleDotBase, d.style]} pointerEvents="none"><View style={[styles.particleDot, { backgroundColor: d.color, width: d.size, height: d.size, borderRadius: d.size / 2 }]} /></Animated.View>))}
            {miniHearts.map((h, i) => (<Animated.View key={i} style={[styles.miniHeartBase, h.style]} pointerEvents="none"><Ionicons name="heart" size={h.size} color={h.color} /></Animated.View>))}
            <Animated.View style={[styles.heartPopContainer, animatedHeartStyle]} pointerEvents="none"><Ionicons name="heart" size={80} color="#FF3B30" /></Animated.View>
        </View>
    ), [onMainTap, animatedFlashStyle, particleDots, miniHearts, animatedHeartStyle]);

    if (!visible || photos.length === 0) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.root}>
                <StatusBar hidden />
                <FlatList ref={listRef} data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} initialScrollIndex={startIndex} getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })} onMomentumScrollEnd={onScroll} keyExtractor={p => p._id} renderItem={renderPage} windowSize={3} initialNumToRender={1} maxToRenderPerBatch={2} removeClippedSubviews />
                {controlsVisible && (
                    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(150)} style={[styles.topOverlay, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
                        <LinearGradient colors={["rgba(0,0,0,0.7)", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                        <View style={styles.topRow}>
                            <TouchableOpacity onPress={onClose} style={styles.circleBtn} hitSlop={12}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                            <View style={styles.counterPill}><Text style={styles.counterText}>{idx + 1} <Text style={{ fontWeight: "400", opacity: 0.6 }}>/ {photos.length}</Text></Text></View>
                            <View style={{ width: 44 }} />
                        </View>
                    </Animated.View>
                )}
                {controlsVisible && (
                    <Animated.View entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(200)} style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
                        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                        <View style={styles.bottomContent}>
                            <View style={styles.infoSection}>
                                <Text style={styles.photoTitle} numberOfLines={2}>{photo?.title || "Untitled"}</Text>
                                <View style={styles.folderBadge}><Ionicons name="folder-open" size={12} color="#00C6FF" /><Text style={styles.folderText}>{photo?.folder || "Memory"}</Text></View>
                                {photo?.status === 'rejected' && (
                                    <View style={styles.rejectionSection}>
                                        <Ionicons name="warning-outline" size={14} color="#FF6B6B" /><Text style={styles.rejectionTitle}>Admin Reason:</Text>
                                        <Text style={styles.rejectionReason} numberOfLines={3}>{photo?.rejectionReason || "No reason specified"}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.actionRow}>
                                <TouchableOpacity onPress={() => toggleLike()} style={styles.actionBtn} hitSlop={8}>
                                    <View style={[styles.actionIcon, { backgroundColor: (photo?._id && localLikes[photo._id]?.isLiked) ? "rgba(255,59,48,0.2)" : "rgba(255,255,255,0.1)" }]}>
                                        <Ionicons name={(photo?._id && localLikes[photo._id]?.isLiked) ? "heart" : "heart-outline"} size={22} color={(photo?._id && localLikes[photo._id]?.isLiked) ? "#FF3B30" : "#fff"} />
                                    </View>
                                    <Text style={[styles.actionLabel, (photo?._id && localLikes[photo._id]?.isLiked) && { color: "#FF3B30" }]}>{(photo?._id && localLikes[photo._id]?.count) ?? 0}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setRequestType('rename'); setRequestModalVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.actionBtn} hitSlop={8}>
                                    <View style={[styles.actionIcon, { backgroundColor: "rgba(0,198,255,0.2)" }]}><Ionicons name="pencil" size={20} color="#00C6FF" /></View>
                                    <Text style={styles.actionLabel}>Rename</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setRequestType('deletion'); setRequestModalVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.actionBtn} hitSlop={8}>
                                    <View style={[styles.actionIcon, { backgroundColor: "rgba(255,107,107,0.2)" }]}><Ionicons name="trash" size={20} color="#FF6B6B" /></View>
                                    <Text style={styles.actionLabel}>Delete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setRequestModalVisible(true)} style={styles.actionBtn} hitSlop={8}>
                                    <View style={[styles.actionIcon, { backgroundColor: "rgba(0,122,255,0.2)" }]}><Ionicons name="chatbubble-ellipses" size={20} color="#007AFF" /></View>
                                    <Text style={styles.actionLabel}>Admin</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                )}
                <Modal visible={requestModalVisible} transparent animationType="slide">
                    <View style={styles.fullOverlay}><BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
                            <View style={styles.requestCard}>
                                <Text style={styles.requestModalTitle}>Message Admin</Text>
                                <Text style={styles.requestSubtitle}>Regarding: {photo?.title}</Text>
                                <View style={styles.requestTypeRow}>
                                    {['deletion', 'rename', 'general'].map(t => (
                                        <TouchableOpacity key={t} style={[styles.typeBtn, requestType === t && styles.typeBtnActive]} onPress={() => setRequestType(t as any)}>
                                            <Text style={[styles.typeBtnText, requestType === t && styles.typeBtnTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View style={styles.inputContainer}><TextInput style={[styles.centeredInput, { height: 100 }]} placeholder={requestType === 'deletion' ? "Reason for deletion..." : requestType === 'rename' ? "Enter new title..." : "Ask us anything..."} placeholderTextColor="rgba(255,255,255,0.3)" multiline value={requestMessage} onChangeText={setRequestMessage} /></View>
                                <View style={styles.renameButtonsRow}><TouchableOpacity onPress={() => setRequestModalVisible(false)} style={styles.renameBtnBase}><Text style={styles.renameBtnCancel}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={submitRequest} style={[styles.renameBtnBase, styles.renameBtnSave]}><Text style={styles.renameSaveText}>Send</Text></TouchableOpacity></View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>
                {busy && (<View style={styles.busyOverlay}><ActivityIndicator size="large" color="#00C6FF" /></View>)}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000" },
    page: { width: SCREEN_W, height: SCREEN_H, backgroundColor: "#000" },
    zoomContent: { width: SCREEN_W, height: SCREEN_H, justifyContent: "center", alignItems: "center" },
    image: { width: SCREEN_W, height: SCREEN_H },
    topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 50, paddingHorizontal: 16, paddingBottom: 20 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
    counterPill: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    counterText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },
    bottomOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, paddingHorizontal: 20, paddingTop: 50 },
    bottomContent: {},
    infoSection: { marginBottom: 16 },
    photoTitle: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.5, lineHeight: 30 },
    folderBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(0,198,255,0.12)", borderRadius: 8, alignSelf: "flex-start" },
    folderText: { color: "#00C6FF", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
    rejectionSection: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12, padding: 12, backgroundColor: "rgba(255,107,107,0.12)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,107,107,0.2)" },
    rejectionTitle: { color: "#FF6B6B", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
    rejectionReason: { flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "500", lineHeight: 18 },
    actionRow: { flexDirection: "row", gap: 12 },
    actionBtn: { alignItems: "center", gap: 4 },
    actionIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
    actionLabel: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
    fullOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", zIndex: 200 },
    keyboardView: { width: "100%", paddingHorizontal: 24, alignItems: "center" },
    requestCard: { width: "100%", backgroundColor: "rgba(30,30,30,0.92)", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 20 },
    requestModalTitle: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
    requestSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", marginBottom: 20 },
    requestTypeRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    typeBtnActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
    typeBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700" },
    typeBtnTextActive: { color: "#fff" },
    inputContainer: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginBottom: 24 },
    centeredInput: { color: "#fff", fontSize: 18, fontWeight: "600", paddingVertical: 14, paddingHorizontal: 16, textAlign: "center" },
    renameButtonsRow: { flexDirection: "row", gap: 12 },
    renameBtnBase: { flex: 1, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
    renameBtnSave: { backgroundColor: "#00C6FF" },
    renameBtnCancel: { color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: "600" },
    renameSaveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 300 },
    heartPopContainer: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40, zIndex: 150, shadowColor: "#FF3B30", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 30, elevation: 15 },
    miniHeartBase: { position: 'absolute', top: '50%', left: '50%', marginTop: -10, marginLeft: -10, zIndex: 120 },
    particleDotBase: { position: 'absolute', top: '50%', left: '50%', marginTop: -4, marginLeft: -4, zIndex: 130 },
    particleDot: {},
});
