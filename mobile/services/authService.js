import api from "./api";

export const signup = async (name, email, password, role = "student") => {
  const res = await api.post("/auth/signup", {
    name,
    email,
    password,
    role,
  });
  return res.data;
};

export const login = async (email, password) => {
  const res = await api.post("/auth/login", {
    email,
    password,
  });
  return res.data;
};
