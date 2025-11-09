
import axios from "axios";
import { authHeader } from "./auth";
import { baseUrl } from "./baseUrl";

// Base axios instance
const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true, // if you use httpOnly cookies; safe to keep
});

// Request interceptor: attach Authorization
api.interceptors.request.use((config) => {
  config.headers = {
    "Content-Type": "application/json",
    ...config.headers,
    ...authHeader(),
  };
  return config;
});

export default api;
