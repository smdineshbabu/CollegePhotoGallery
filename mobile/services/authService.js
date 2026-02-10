import api from "./api";
import { saveAuth, clearAuth } from "./authStorage";

export const signup = async (name, email, password, role) => {
  const response = await api.post("/auth/signup", {
    name,
    email,
    password,
    role,
  });

  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  const { token, role } = response.data;

  await saveAuth(token, role);

  return response.data;
};

export const logout = async () => {
  await clearAuth();
};
