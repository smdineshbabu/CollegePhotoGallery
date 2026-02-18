import axios from "axios";
import * as authStorage from "./authStorage";

import { Platform } from "react-native";

import Constants from "expo-constants";

const getBaseUrl = () => {
  if (Platform.OS === "web") {
    return "http://localhost:5000/api";
  }
  // Try to get from app.json extra, fallback to old hardcoded
  return Constants.expoConfig?.extra?.apiUrl || "http://10.73.154.112:5000/api";
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "bypass-tunnel-reminder": "true",
  },
});

api.interceptors.request.use(async (config) => {
  const token = await authStorage.getAuthToken();
  const serverUrl = await authStorage.getServerUrl();

  if (serverUrl) {
    let finalUrl = serverUrl.replace(/\s/g, "");
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "http://" + finalUrl;
    }
    if (finalUrl.endsWith("/")) {
      finalUrl = finalUrl.slice(0, -1);
    }
    if (!finalUrl.endsWith("/api")) {
      finalUrl += "/api";
    }
    config.baseURL = finalUrl;
  }

  // Debug log to help track connectivity issues
  console.log(`[API] --- Request: ${config.method?.toUpperCase()} ${config.url} ---`);
  console.log(`[API] BaseURL: ${config.baseURL}`);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
