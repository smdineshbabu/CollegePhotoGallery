import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Alert,
    Modal
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as authService from "../services/authService";
import * as authStorage from "../services/authStorage";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
    const router = useRouter();

    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("student");

    const handleAuth = async () => {
        if (!email || !password || (!isLogin && !name)) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        try {
            setLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (isLogin) {
                await authService.login(email, password);
            } else {
                await authService.signup(name, email, password, role);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace("/(tabs)/home");
        } catch (error: any) {
            console.error("Auth Error:", error);
            Alert.alert("Authentication Failed", error.response?.data?.message || "Something went wrong. Please try again.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    // Server URL State
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [serverUrl, setServerUrl] = useState("");

    React.useEffect(() => {
        const loadUrl = async () => {
            const url = await authStorage.getServerUrl();
            setServerUrl(url || "http://10.73.154.112:5000/api");
        };
        loadUrl();
    }, []);

    const handleResetDefault = async () => {
        const defaultUrl = "10.73.154.112:5000";
        setServerUrl(defaultUrl);
        await authStorage.saveServerUrl(defaultUrl);
        Alert.alert("Reset", "Server URL reset to default!");
    };

    const handleSaveUrl = async () => {
        if (!serverUrl.trim()) return;
        await authStorage.saveServerUrl(serverUrl.trim());
        setIsSettingsVisible(false);
        Alert.alert("Success", "Server URL updated! App will now connect to " + serverUrl);
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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={styles.settingsIcon}
                    onPress={() => setIsSettingsVisible(true)}
                >
                    <Ionicons name="settings-outline" size={24} color="#000" style={{ opacity: 0.5 }} />
                </TouchableOpacity>

                <View style={styles.headerContainer}>
                    <Image
                        source="https://img.icons8.com/fluency/144/camera.png"
                        style={styles.logo}
                        transition={300}
                    />
                    <Text style={styles.title}>College Gallery</Text>
                    <Text style={styles.subtitle}>
                        {isLogin ? "Welcome back, scholar!" : "Start sharing your memories"}
                    </Text>
                </View>

                <View style={styles.formContainer}>
                    {!isLogin && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="John Doe"
                                placeholderTextColor="#999"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@college.edu"
                            placeholderTextColor="#999"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>


                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={["#007AFF", "#0056D2"]}
                            style={styles.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    {isLogin ? "Sign In" : "Create Account"}
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setIsLogin(!isLogin);
                        }}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {isLogin
                                ? "Don't have an account? Sign Up"
                                : "Already have an account? Sign In"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

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

                        <TouchableOpacity style={styles.cancelButton} onPress={() => setIsSettingsVisible(false)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scrollContainer: {
        flexGrow: 1,
        paddingHorizontal: 30,
        paddingTop: height * 0.1,
        paddingBottom: 40,
    },
    settingsIcon: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
        zIndex: 10,
    },
    headerContainer: {
        alignItems: "center",
        marginBottom: 40,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 15,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: "#1A1A1A",
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: "#666",
        marginTop: 5,
    },
    formContainer: {
        width: "100%",
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        color: "#444",
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: "#F8F9FA",
        borderRadius: 15,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#EFEFEF",
        color: "#1A1A1A",
    },
    primaryButton: {
        marginTop: 10,
        borderRadius: 15,
        overflow: "hidden",
        shadowColor: "#007AFF",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    gradient: {
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    secondaryButton: {
        marginTop: 20,
        alignItems: "center",
    },
    secondaryButtonText: {
        color: "#007AFF",
        fontSize: 15,
        fontWeight: "600",
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
    },
    saveButton: {
        backgroundColor: "#007AFF",
        width: "100%",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 12,
    },
    saveButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    cancelButton: {
        padding: 12,
    },
    cancelButtonText: {
        color: "#666",
        fontSize: 16,
    },
});
