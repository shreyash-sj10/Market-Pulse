import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, logoutUser } from "../../v2/api/auth.api.js";
import { setAccessToken, clearAccessToken, getAccessToken } from "../../v2/api/accessTokenStore.js";
import {
  bootstrapAccessTokenFromCookies,
  setStoredCsrfToken,
  clearStoredCsrfToken,
} from "../../v2/api/api.js";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Path A (P0-C): access JWT in memory only + HttpOnly refresh cookie + SameSite=strict (server).
 * CSRF value for refresh is mirrored in sessionStorage from login/refresh JSON when cookies are not readable (cross-origin SPA).
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(({ token, user: userData, csrfToken }) => {
    setAccessToken(token);
    if (csrfToken) {
      setStoredCsrfToken(csrfToken);
    }
    setUser(userData);
    try {
      localStorage.setItem("user", JSON.stringify(userData));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(async () => {
    const hadToken = Boolean(getAccessToken());
    try {
      if (hadToken) {
        await logoutUser();
      }
    } catch {
      /* best-effort: still clear client session */
    } finally {
      clearAccessToken();
      clearStoredCsrfToken();
      try {
        localStorage.removeItem("user");
      } catch {
        /* ignore */
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        let legacyToken = null;
        try {
          legacyToken = localStorage.getItem("token");
          if (legacyToken) {
            localStorage.removeItem("token");
            setAccessToken(legacyToken);
          }
        } catch {
          /* ignore */
        }

        if (!getAccessToken()) {
          await bootstrapAccessTokenFromCookies();
        }
        if (cancelled) return;

        if (getAccessToken()) {
          try {
            const data = await getMe();
            if (!cancelled && data?.user) {
              setUser(data.user);
              try {
                localStorage.setItem("user", JSON.stringify(data.user));
              } catch {
                /* ignore */
              }
            }
          } catch {
            clearAccessToken();
            clearStoredCsrfToken();
            if (!cancelled) {
              setUser(null);
              try {
                localStorage.removeItem("user");
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          try {
            localStorage.removeItem("user");
          } catch {
            /* ignore */
          }
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== "user") return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        setUser(JSON.parse(event.newValue));
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
