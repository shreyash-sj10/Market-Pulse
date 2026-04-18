import axios from "axios";

/**
 * Backend mounts all routes under /api. Env may be origin only (http://host:port) or full base including /api.
 */
function resolveApiBaseUrl() {
  const raw =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "http://localhost:5001";
  const trimmed = String(raw).replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

const BASE_URL = resolveApiBaseUrl();
const isDev = import.meta.env.DEV;
let refreshPromise = null;
const createRequestId = () =>
  (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

const getCookieValue = (name) => {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(name.length + 1));
};

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const requestId = createRequestId();
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers["x-request-id"] = requestId;
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
    config.metadata = { requestId, startedAt: Date.now() };
    if (isDev) {
      console.log("[API:REQ]", {
        id: requestId,
        method: config.method?.toUpperCase(),
        url: config.url,
      });
    }
    return config;
  },
  (error) => {
    console.error("API Error", error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 and refresh token silently
api.interceptors.response.use(
  (response) => {
    if (isDev) {
      const elapsed = Date.now() - (response.config?.metadata?.startedAt || Date.now());
      console.log("[API:RES]", {
        id: response.headers?.["x-request-id"] || response.config?.metadata?.requestId,
        method: response.config?.method?.toUpperCase(),
        url: response.config?.url,
        status: response.status,
        latencyMs: elapsed,
        degraded: Boolean(response.data?.degraded),
      });
    }
    return response;
  },
  async (error) => {
    console.error("API Error", error);
    const originalRequest = error.config;
    if (isDev) {
      const elapsed = Date.now() - (originalRequest?.metadata?.startedAt || Date.now());
      console.log("[API:ERR]", {
        id: error.response?.headers?.["x-request-id"] || originalRequest?.metadata?.requestId,
        method: originalRequest?.method?.toUpperCase(),
        url: originalRequest?.url,
        status: error.response?.status,
        latencyMs: elapsed,
        message: error.message,
      });
    }

    // If error is 401 and we haven't already retried this request
    // IMPORTANT: Exclude login/register routes from automatic retry to prevent loops on bad credentials
    const url = originalRequest?.url ?? "";
    const isAuthPath = url.includes("/auth/login") || url.includes("/auth/register");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthPath) {
      originalRequest._retry = true;

      const csrfToken = getCookieValue("csrfToken");
      if (!csrfToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${BASE_URL}/auth/refresh`,
            {},
            {
              withCredentials: true,
              headers: { "x-csrf-token": csrfToken },
            },
          );
        }
        const { data } = await refreshPromise;

        const newToken = data.token;
        localStorage.setItem("token", newToken);
        window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: newToken }));

        // Mutate original request header and retry it safely
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        console.error("API Error", err);
        // Refresh token failed or expired -> kill session
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
