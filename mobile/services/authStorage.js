import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const saveAuthData = async (token, user) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getAuthToken = async () => {
  return await AsyncStorage.getItem(TOKEN_KEY);
};

export const getAuthUser = async () => {
  const user = await AsyncStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const clearAuthData = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
};

const URL_KEY = "server_url";

export const saveServerUrl = async (url) => {
  await AsyncStorage.setItem(URL_KEY, url);
};

export const getServerUrl = async () => {
  return await AsyncStorage.getItem(URL_KEY);
};
