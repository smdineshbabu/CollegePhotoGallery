import api from "./api";
import * as authStorage from "./authStorage";

export const signup = async (name, email, password, role = "student") => {
  const res = await api.post("/auth/signup", {
    name,
    email,
    password,
    role,
  });
  if (res.data.token) {
    await authStorage.saveAuthData(res.data.token, res.data.user);
  }
  return res.data;
};

export const login = async (email, password) => {
  const res = await api.post("/auth/login", {
    email,
    password,
  });
  if (res.data.token) {
    await authStorage.saveAuthData(res.data.token, res.data.user);
  }
  return res.data;
};

export const logout = async () => {
  await authStorage.clearAuthData();
};

export const isAuthenticated = async () => {
  const token = await authStorage.getAuthToken();
  return !!token;
};

export const getCurrentUser = async () => {
  return await authStorage.getAuthUser();
};
