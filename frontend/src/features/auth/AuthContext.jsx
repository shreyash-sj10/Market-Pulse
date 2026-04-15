import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../../services/auth.api.js";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (savedUser === "undefined" || !savedUser || !token) return null;
      return JSON.parse(savedUser);
    } catch (e) {
      console.warn("[AuthContext] Corrupted state detected. Resetting.");
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("token") && !localStorage.getItem("user"));

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      getMe()
        .then((data) => {
          localStorage.setItem("user", JSON.stringify(data.user));
          setUser(data.user);
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === "token" && !event.newValue) {
        setUser(null);
      }
      if (event.key === "user" && event.newValue) {
        try {
          setUser(JSON.parse(event.newValue));
        } catch {
          setUser(null);
        }
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
