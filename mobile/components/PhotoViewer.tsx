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
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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
            console.log("[PhotoViewer] Internal user missing, fetching locally...");
            authService.getCurrentUser().then(user => {
                if (user) {
                    console.log("[PhotoViewer] Fetched user locally:", user._id);
                    setInternalUser(user);
                    // Update initial likes if we just got the user
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
                } else {
                    console.warn("[PhotoViewer] No user found locally.");
                }
            });
        }
    }, [visible, internalUser]);

    const toggleLike = useCallback(async (specificId?: string) => {
        const targetId = specificId || photo?._id;

        // Aggressive user check: Try internal state, then currentUser prop, then fetch from storage
        let activeUser = internalUser || currentUser;

        if (!activeUser) {
            console.log("[LIKE] No activeUser in memory, attempting urgent fetch...");
            try {
                activeUser = await authService.getCurrentUser();
                if (activeUser) {
                    setInternalUser(activeUser);
                    console.log("[LIKE] Urgent fetch successful:", activeUser._id);
                }
            } catch (e) {
                console.error("[LIKE] Urgent fetch failed:", e);
            }
        }

        console.log(`[LIKE] toggleLike called for ${targetId}. ActiveUser: ${activeUser?._id}`);

        if (!targetId || !activeUser) {
            if (!activeUser) {
                console.warn("[LIKE] No activeUser found after all attempts!");
                Alert.alert("Authentication Error", "You need to be logged in to like photos. Please restart the app or log in again.");
            }
            return;
        }

        const currentPhotoLikes = localLikes[targetId] || { count: 0, isLiked: false };
        const newIsLiked = !currentPhotoLikes.isLiked;
        const newCount = newIsLiked ? currentPhotoLikes.count + 1 : currentPhotoLikes.count - 1;

        console.log(`[LIKE] Optimistic update: ${newIsLiked ? 'Liking' : 'Unliking'}. New count: ${newCount}`);

        // Optimistic update
        setLocalLikes(prev => ({
            ...prev,
            [targetId]: { count: Math.max(0, newCount), isLiked: newIsLiked }
        }));

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const response = await api.patch(`/upload/${targetId}/like`);
            console.log(`[LIKE] Server response:`, response.data);
            const { likesCount, isLiked } = response.data;

            // Sync with server response
            setLocalLikes(prev => ({
                ...prev,
                [targetId]: { count: likesCount, isLiked }
            }));

            onLikeToggle?.(targetId, isLiked, likesCount);
        } catch (err) {
            console.error("[LIKE] API Error:", err);
            // Revert on error
            setLocalLikes(prev => ({ ...prev, [targetId]: currentPhotoLikes }));
        }
    }, [photo, internalUser, localLikes, onLikeToggle]);

    // ─── Premium Heart Animation ─────────────────────────────────────
    // Layer 1: Center heart
    const heartScale = useSharedValue(0);
    const heartOpacity = useSharedValue(0);
    const heartRotate = useSharedValue(0);

    // Layer 2: Screen flash
    const flashOpacity = useSharedValue(0);

    // Layer 3: Ripple ring (two rings)
    const rippleScale = useSharedValue(0.3);
    const rippleOpacity = useSharedValue(0);
    const ripple2Scale = useSharedValue(0.3);
    const ripple2Opacity = useSharedValue(0);

    // Layer 4: Mini floating hearts (6 of them)
    const mini1X = useSharedValue(0); const mini1Y = useSharedValue(0); const mini1O = useSharedValue(0); const mini1S = useSharedValue(0);
    const mini2X = useSharedValue(0); const mini2Y = useSharedValue(0); const mini2O = useSharedValue(0); const mini2S = useSharedValue(0);
    const mini3X = useSharedValue(0); const mini3Y = useSharedValue(0); const mini3O = useSharedValue(0); const mini3S = useSharedValue(0);
    const mini4X = useSharedValue(0); const mini4Y = useSharedValue(0); const mini4O = useSharedValue(0); const mini4S = useSharedValue(0);
    const mini5X = useSharedValue(0); const mini5Y = useSharedValue(0); const mini5O = useSharedValue(0); const mini5S = useSharedValue(0);
    const mini6X = useSharedValue(0); const mini6Y = useSharedValue(0); const mini6O = useSharedValue(0); const mini6S = useSharedValue(0);

    // Layer 5: Particle dots (8 small circles bursting radially)
    const dot1X = useSharedValue(0); const dot1Y = useSharedValue(0); const dot1O = useSharedValue(0); const dot1S = useSharedValue(0);
    const dot2X = useSharedValue(0); const dot2Y = useSharedValue(0); const dot2O = useSharedValue(0); const dot2S = useSharedValue(0);
    const dot3X = useSharedValue(0); const dot3Y = useSharedValue(0); const dot3O = useSharedValue(0); const dot3S = useSharedValue(0);
    const dot4X = useSharedValue(0); const dot4Y = useSharedValue(0); const dot4O = useSharedValue(0); const dot4S = useSharedValue(0);
    const dot5X = useSharedValue(0); const dot5Y = useSharedValue(0); const dot5O = useSharedValue(0); const dot5S = useSharedValue(0);
    const dot6X = useSharedValue(0); const dot6Y = useSharedValue(0); const dot6O = useSharedValue(0); const dot6S = useSharedValue(0);
    const dot7X = useSharedValue(0); const dot7Y = useSharedValue(0); const dot7O = useSharedValue(0); const dot7S = useSharedValue(0);
    const dot8X = useSharedValue(0); const dot8Y = useSharedValue(0); const dot8O = useSharedValue(0); const dot8S = useSharedValue(0);

    // Layer 6: Glow ring behind center heart
    const glowScale = useSharedValue(0);
    const glowOpacity = useSharedValue(0);

    const animatedHeartStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: heartScale.value },
            { rotate: `${heartRotate.value}deg` },
        ],
        opacity: heartOpacity.value,
    }));

    const animatedFlashStyle = useAnimatedStyle(() => ({
        opacity: flashOpacity.value,
    }));

    const animatedRippleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: rippleScale.value }],
        opacity: rippleOpacity.value,
    }));

    const animatedRipple2Style = useAnimatedStyle(() => ({
        transform: [{ scale: ripple2Scale.value }],
        opacity: ripple2Opacity.value,
    }));

    const makeDotStyle = (x: any, y: any, o: any, s: any) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useAnimatedStyle(() => ({
            transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
            opacity: o.value,
        }));

    const animDot1 = makeDotStyle(dot1X, dot1Y, dot1O, dot1S);
    const animDot2 = makeDotStyle(dot2X, dot2Y, dot2O, dot2S);
    const animDot3 = makeDotStyle(dot3X, dot3Y, dot3O, dot3S);
    const animDot4 = makeDotStyle(dot4X, dot4Y, dot4O, dot4S);
    const animDot5 = makeDotStyle(dot5X, dot5Y, dot5O, dot5S);
    const animDot6 = makeDotStyle(dot6X, dot6Y, dot6O, dot6S);
    const animDot7 = makeDotStyle(dot7X, dot7Y, dot7O, dot7S);
    const animDot8 = makeDotStyle(dot8X, dot8Y, dot8O, dot8S);

    const animatedGlowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowScale.value }],
        opacity: glowOpacity.value,
    }));

    // 8 dots at 45° intervals: right, down-right, down, down-left, left, up-left, up, up-right
    const particleDots = [
        { style: animDot1, x: dot1X, y: dot1Y, o: dot1O, s: dot1S, dx: 110, dy: 0, color: '#FF3B30', size: 8 },
        { style: animDot2, x: dot2X, y: dot2Y, o: dot2O, s: dot2S, dx: 78, dy: -78, color: '#FF6B9D', size: 6 },
        { style: animDot3, x: dot3X, y: dot3Y, o: dot3O, s: dot3S, dx: 0, dy: -110, color: '#FF3B30', size: 8 },
        { style: animDot4, x: dot4X, y: dot4Y, o: dot4O, s: dot4S, dx: -78, dy: -78, color: '#FF6B9D', size: 6 },
        { style: animDot5, x: dot5X, y: dot5Y, o: dot5O, s: dot5S, dx: -110, dy: 0, color: '#FF3B30', size: 8 },
        { style: animDot6, x: dot6X, y: dot6Y, o: dot6O, s: dot6S, dx: -78, dy: 78, color: '#FF6B9D', size: 6 },
        { style: animDot7, x: dot7X, y: dot7Y, o: dot7O, s: dot7S, dx: 0, dy: 110, color: '#FF3B30', size: 8 },
        { style: animDot8, x: dot8X, y: dot8Y, o: dot8O, s: dot8S, dx: 78, dy: 78, color: '#FF6B9D', size: 6 },
    ];

    const makeMiniStyle = (x: any, y: any, o: any, s: any) =>
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useAnimatedStyle(() => ({
            transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
            opacity: o.value,
        }));

    const animMini1 = makeMiniStyle(mini1X, mini1Y, mini1O, mini1S);
    const animMini2 = makeMiniStyle(mini2X, mini2Y, mini2O, mini2S);
    const animMini3 = makeMiniStyle(mini3X, mini3Y, mini3O, mini3S);
    const animMini4 = makeMiniStyle(mini4X, mini4Y, mini4O, mini4S);
    const animMini5 = makeMiniStyle(mini5X, mini5Y, mini5O, mini5S);
    const animMini6 = makeMiniStyle(mini6X, mini6Y, mini6O, mini6S);

    const miniHearts = [
        { style: animMini1, x: mini1X, y: mini1Y, o: mini1O, s: mini1S, dx: -60, dy: -90, size: 22, color: '#FF3B30' },
        { style: animMini2, x: mini2X, y: mini2Y, o: mini2O, s: mini2S, dx: 60, dy: -90, size: 18, color: '#FF6B9D' },
        { style: animMini3, x: mini3X, y: mini3Y, o: mini3O, s: mini3S, dx: -90, dy: -40, size: 16, color: '#FF3B30' },
        { style: animMini4, x: mini4X, y: mini4Y, o: mini4O, s: mini4S, dx: 90, dy: -40, size: 20, color: '#FF6B9D' },
        { style: animMini5, x: mini5X, y: mini5Y, o: mini5O, s: mini5S, dx: -40, dy: -120, size: 14, color: '#FF3B30' },
        { style: animMini6, x: mini6X, y: mini6Y, o: mini6O, s: mini6S, dx: 40, dy: -120, size: 12, color: '#FF6B9D' },
    ];

    const triggerHeartPop = useCallback(() => {
        'worklet';

        // ── Center heart: 3-bounce spring, then fade ──
        heartScale.value = 0;
        heartRotate.value = -12;
        heartOpacity.value = 1;
        heartScale.value = withSequence(
            withSpring(1.6, { damping: 4, stiffness: 280 }),   // big pop
            withSpring(1.2, { damping: 6, stiffness: 300 }),   // settle
            withSpring(1.35, { damping: 8, stiffness: 250 }),  // second bounce
            withSpring(1.0, { damping: 10, stiffness: 300 }),  // rest
            withDelay(250, withTiming(0, { duration: 350 }))
        );
        heartRotate.value = withSequence(
            withSpring(14, { damping: 5 }),
            withSpring(-10, { damping: 7 }),
            withSpring(6, { damping: 9 }),
            withSpring(0, { damping: 12 })
        );
        heartOpacity.value = withDelay(600, withTiming(0, { duration: 300 }));

        // ── Glow ring: pulses behind the heart ──
        glowScale.value = 0.5;
        glowOpacity.value = 0.9;
        glowScale.value = withSequence(
            withSpring(1.8, { damping: 5, stiffness: 150 }),
            withTiming(2.5, { duration: 400 })
        );
        glowOpacity.value = withDelay(100, withTiming(0, { duration: 600 }));

        // ── Screen flash: quick bright burst ──
        flashOpacity.value = 0.35;
        flashOpacity.value = withSequence(
            withTiming(0.15, { duration: 120 }),
            withTiming(0.28, { duration: 80 }),
            withTiming(0, { duration: 300 })
        );

        // ── Ripple ring 1: fast ──
        rippleScale.value = 0.2;
        rippleOpacity.value = 1;
        rippleScale.value = withTiming(3.2, { duration: 650 });
        rippleOpacity.value = withTiming(0, { duration: 650 });

        // ── Ripple ring 2: delayed, slower ──
        ripple2Scale.value = 0.2;
        ripple2Opacity.value = 0;
        ripple2Scale.value = withDelay(200, withTiming(4.0, { duration: 800 }));
        ripple2Opacity.value = withDelay(200, withSequence(
            withTiming(0.7, { duration: 100 }),
            withTiming(0, { duration: 700 })
        ));

        // ── Particle dots: burst radially, staggered 30ms each ──
        particleDots.forEach(({ x, y, o, s, dx, dy }, i) => {
            const delay = i * 30;
            x.value = 0; y.value = 0; o.value = 0; s.value = 0;
            o.value = withDelay(delay, withTiming(1, { duration: 60 }));
            s.value = withDelay(delay, withSpring(1.3, { damping: 5, stiffness: 400 }));
            x.value = withDelay(delay, withSpring(dx, { damping: 7, stiffness: 180 }));
            y.value = withDelay(delay, withSpring(dy, { damping: 7, stiffness: 180 }));
            o.value = withDelay(delay + 300, withTiming(0, { duration: 350 }));
        });

        // ── Mini hearts: staggered launches (wave 1 then wave 2) ──
        const wave1 = miniHearts.slice(0, 3);
        const wave2 = miniHearts.slice(3);

        wave1.forEach(({ x, y, o, s, dx, dy }) => {
            x.value = 0; y.value = 0; o.value = 0; s.value = 0;
            o.value = withTiming(1, { duration: 80 });
            s.value = withSpring(1.2, { damping: 6, stiffness: 300 });
            x.value = withSpring(dx, { damping: 8, stiffness: 150 });
            y.value = withSpring(dy, { damping: 8, stiffness: 150 });
            o.value = withDelay(350, withTiming(0, { duration: 400 }));
        });

        wave2.forEach(({ x, y, o, s, dx, dy }) => {
            x.value = 0; y.value = 0; o.value = 0; s.value = 0;
            o.value = withDelay(120, withTiming(1, { duration: 80 }));
            s.value = withDelay(120, withSpring(1.0, { damping: 7, stiffness: 250 }));
            x.value = withDelay(120, withSpring(dx * 1.3, { damping: 9, stiffness: 130 }));
            y.value = withDelay(120, withSpring(dy * 1.3, { damping: 9, stiffness: 130 }));
            o.value = withDelay(480, withTiming(0, { duration: 350 }));
        });
    }, []);


    const submitRequest = async () => {
        if (!requestMessage.trim()) {
            Alert.alert("Error", "Please enter a reason/message.");
            return;
        }
        try {
            setBusy(true);
            await api.post("/requests", {
                photoId: photo?._id,
                message: requestMessage.trim(),
                type: requestType
            });
            setRequestModalVisible(false);
            setRequestMessage("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Request sent to admin.");
        } catch (err) {
            Alert.alert("Error", "Failed to send request.");
        } finally {
            setBusy(false);
        }
    };

    // Sync index on open
    useEffect(() => {
        if (visible) {
            setIdx(startIndex);
            setBusy(false);
            setControlsVisible(true);
        }
    }, [visible, startIndex]);


    // ─── Handlers ────────────────────────────────────────────────────
    const onScroll = useCallback(
        (e: any) => {
            const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            if (newIdx !== idx && newIdx >= 0 && newIdx < photos.length) {
                setIdx(newIdx);
                onSwipe?.(newIdx);
                Haptics.selectionAsync();
            }
        },
        [idx, photos.length, onSwipe]
    );

    const promptRename = () => {
        if (!photo) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRequestType('rename');
        setRequestModalVisible(true);
    };

    const confirmDelete = () => {
        if (!photo) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRequestType('deletion');
        setRequestModalVisible(true);
        // We could also pre-fill some text or just let them type the reason
    };

    const toggleControls = () => {
        setControlsVisible((v) => !v);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Manual double-tap detector using a tap counter ref
    const tapCountRef = useRef(0);
    const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTap = useCallback((itemId: string) => {
        const now = Date.now();
        const lastTap = tapCountRef.current;

        if (lastTap > 0 && (now - lastTap) < 300) {
            // ── DOUBLE TAP detected — fire animation INSTANTLY ──
            if (tapTimerRef.current) {
                clearTimeout(tapTimerRef.current);
                tapTimerRef.current = null;
            }
            tapCountRef.current = 0;

            const currentLikes = localLikes[itemId];
            const isAlreadyLiked = currentLikes?.isLiked;

            if (isAlreadyLiked) {
                // User said: "double tap should give like again... should not decrease count"
                // So if already liked, just re-play the visual pop
                triggerHeartPop();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
                triggerHeartPop();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                toggleLike(itemId);
            }
        } else {
            // ── First tap — record timestamp, wait to see if double tap follows ──
            tapCountRef.current = now;
            tapTimerRef.current = setTimeout(() => {
                tapCountRef.current = 0;
                // Only toggle controls if no second tap came
                toggleControls();
            }, 200);
        }
    }, [triggerHeartPop, toggleLike, toggleControls, localLikes]);


    const renderPage = useCallback(
        ({ item }: { item: Photo }) => {
            return (
                <View style={styles.page}>
                    {/* Scrollable zoom layer */}
                    <ScrollView
                        style={StyleSheet.absoluteFill}
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

                    {/* Transparent tap overlay — sits above the ScrollView */}
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => handleTap(item._id)}
                    />

                    {/* ── Like Animation Layers (all pointerEvents="none") ── */}

                    {/* Screen flash */}
                    <Animated.View
                        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, animatedFlashStyle]}
                        pointerEvents="none"
                    />

                    {/* Glow ring: soft red circle behind the heart */}
                    <Animated.View style={[styles.glowRing, animatedGlowStyle]} pointerEvents="none" />

                    {/* Ripple ring 1: fast */}
                    <Animated.View style={[styles.rippleContainer, animatedRippleStyle]} pointerEvents="none">
                        <View style={styles.rippleRing} />
                    </Animated.View>

                    {/* Ripple ring 2: delayed, larger */}
                    <Animated.View style={[styles.rippleContainer, animatedRipple2Style]} pointerEvents="none">
                        <View style={[styles.rippleRing, { borderColor: 'rgba(255,107,157,0.5)', borderWidth: 2 }]} />
                    </Animated.View>

                    {/* Particle dots: 8 small circles bursting radially */}
                    {particleDots.map((d, i) => (
                        <Animated.View key={`dot-${i}`} style={[styles.particleDotBase, d.style]} pointerEvents="none">
                            <View style={[styles.particleDot, { backgroundColor: d.color, width: d.size, height: d.size, borderRadius: d.size / 2 }]} />
                        </Animated.View>
                    ))}

                    {/* Mini floating hearts */}
                    {miniHearts.map((h, i) => (
                        <Animated.View key={i} style={[styles.miniHeartBase, h.style]} pointerEvents="none">
                            <Ionicons name="heart" size={h.size} color={h.color} />
                        </Animated.View>
                    ))}

                    {/* Center heart (on top of everything) */}
                    <Animated.View style={[styles.heartPopContainer, animatedHeartStyle]} pointerEvents="none">
                        <Ionicons name="heart" size={110} color="#FF3B30" />
                    </Animated.View>





                </View>
            );
        },
        [handleTap, animatedHeartStyle, animatedFlashStyle, animatedRippleStyle, animatedRipple2Style,
            animatedGlowStyle, miniHearts, particleDots]
    );


    const getLayout = useCallback((_: any, i: number) => ({
        length: SCREEN_W,
        offset: SCREEN_W * i,
        index: i,
    }), []);

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
                {controlsVisible && (
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
                {controlsVisible && (
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
                                <TouchableOpacity
                                    onPress={() => toggleLike()}
                                    style={styles.actionBtn}
                                    hitSlop={8}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: (photo?._id && localLikes[photo._id]?.isLiked) ? "rgba(255,59,48,0.2)" : "rgba(255,255,255,0.1)" }]}>
                                        <Ionicons
                                            name={(photo?._id && localLikes[photo._id]?.isLiked) ? "heart" : "heart-outline"}
                                            size={22}
                                            color={(photo?._id && localLikes[photo._id]?.isLiked) ? "#FF3B30" : "#fff"}
                                        />
                                    </View>
                                    <Text style={[styles.actionLabel, (photo?._id && localLikes[photo._id]?.isLiked) && { color: "#FF3B30" }]}>
                                        {((photo?._id && localLikes[photo._id]?.count) ?? 0)}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={promptRename}
                                    style={styles.actionBtn}
                                    hitSlop={8}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: "rgba(0,198,255,0.2)" }]}>
                                        <Ionicons name="pencil" size={20} color="#00C6FF" />
                                    </View>
                                    <Text style={styles.actionLabel}>Rename</Text>
                                </TouchableOpacity>

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

                                <TouchableOpacity
                                    onPress={() => setRequestModalVisible(true)}
                                    style={styles.actionBtn}
                                    hitSlop={8}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: "rgba(0,122,255,0.2)" }]}>
                                        <Ionicons name="chatbubble-ellipses" size={20} color="#007AFF" />
                                    </View>
                                    <Text style={styles.actionLabel}>Admin</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>
                )}


                {/* ═══ REQUEST MODAL ═══ */}
                <Modal visible={requestModalVisible} transparent animationType="slide">
                    <View style={styles.fullOverlay}>
                        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                        <KeyboardAvoidingView
                            behavior={Platform.OS === "ios" ? "padding" : "height"}
                            style={styles.keyboardView}
                        >
                            <View style={styles.requestCard}>
                                <Text style={styles.requestModalTitle}>Message Admin</Text>
                                <Text style={styles.requestSubtitle}>Regarding: {photo?.title}</Text>

                                <View style={styles.requestTypeRow}>
                                    <TouchableOpacity
                                        style={[styles.typeBtn, requestType === 'deletion' && styles.typeBtnActive]}
                                        onPress={() => setRequestType('deletion')}
                                    >
                                        <Text style={[styles.typeBtnText, requestType === 'deletion' && styles.typeBtnTextActive]}>Deletion</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.typeBtn, requestType === 'rename' && styles.typeBtnActive]}
                                        onPress={() => setRequestType('rename')}
                                    >
                                        <Text style={[styles.typeBtnText, requestType === 'rename' && styles.typeBtnTextActive]}>Rename</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.typeBtn, requestType === 'general' && styles.typeBtnActive]}
                                        onPress={() => setRequestType('general')}
                                    >
                                        <Text style={[styles.typeBtnText, requestType === 'general' && styles.typeBtnTextActive]}>General</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.inputContainer}>
                                    <TextInput
                                        style={[styles.centeredInput, { height: 100 }]}
                                        placeholder={
                                            requestType === 'deletion' ? "Reason for deletion..." :
                                                requestType === 'rename' ? "Enter new title for this photo..." :
                                                    "Ask us anything..."
                                        }
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        multiline
                                        value={requestMessage}
                                        onChangeText={setRequestMessage}
                                    />
                                </View>

                                <View style={styles.renameButtonsRow}>
                                    <TouchableOpacity onPress={() => setRequestModalVisible(false)} style={styles.renameBtnBase}>
                                        <Text style={styles.renameBtnCancel}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={submitRequest} style={[styles.renameBtnBase, styles.renameBtnSave]}>
                                        <Text style={styles.renameSaveText}>Send</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal>

                {/* Saving overlay */}
                {busy && (
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
        color: "rgba(255,255,255,0.9)", // Brighter for better visibility
        fontSize: 12, // Slightly larger
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

    requestCard: {
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
    requestModalTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 8,
    },
    requestSubtitle: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 20,
    },
    requestTypeRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 20,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    typeBtnActive: {
        backgroundColor: "#007AFF",
        borderColor: "#007AFF",
    },
    typeBtnText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 13,
        fontWeight: "700",
    },
    typeBtnTextActive: {
        color: "#fff",
    },
    // ─ Busy Overlay ─
    busyOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 300,
    },
    heartPopContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -55,
        marginLeft: -55,
        zIndex: 150,
        shadowColor: "#FF3B30",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
        elevation: 15,
    },
    // ─ Ripple Ring ─
    rippleContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -80,
        marginLeft: -80,
        width: 160,
        height: 160,
        zIndex: 90,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rippleRing: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 3,
        borderColor: 'rgba(255, 59, 48, 0.7)',
        backgroundColor: 'transparent',
    },
    // ─ Mini Hearts ─
    miniHeartBase: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
        zIndex: 120,
    },
    // ─ Glow Ring (behind center heart) ─
    glowRing: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 160,
        height: 160,
        marginTop: -80,
        marginLeft: -80,
        borderRadius: 80,
        backgroundColor: 'rgba(255, 59, 48, 0.35)',
        zIndex: 100,
    },
    // ─ Particle Dots ─
    particleDotBase: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -5,
        marginLeft: -5,
        zIndex: 130,
    },
    particleDot: {
        // size/color applied inline
    },
    // ─ Teardrops ─
    teardropBase: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: 20,   // start just below the heart center
        marginLeft: -5,
        zIndex: 140,
    },
    teardrop: {
        width: 10,
        height: 16,
        borderRadius: 10,
        backgroundColor: '#5B6EF5',
        // teardrop shape: wider at top, pointed at bottom
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    // ─ Grain Dots ─
    grainBase: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -3,
        marginLeft: -3,
        zIndex: 150,
    },
});
