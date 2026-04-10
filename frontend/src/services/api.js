import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:5001/api";

const api = axios.create({
  baseURL: BASE_URL,
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 and refresh token silently
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already retried this request
    // IMPORTANT: Exclude login/register routes from automatic retry to prevent loops on bad credentials
    const isAuthPath = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/register');
    
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthPath) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");
      
      // If no refresh token, force logout
      if (!refreshToken) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Ping refresh endpoint directly from axios to avoid cyclic dependencies
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newToken = data.token;
        const newRefreshToken = data.refreshToken;

        // Persist new tokens
        localStorage.setItem("token", newToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        // Mutate original request header and retry it safely
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh token failed or expired -> kill session
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
