const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const AppError = require("../utils/AppError");

const REFRESH_COOKIE_NAME = "refreshToken";
const CSRF_COOKIE_NAME = "csrfToken";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const generateTokens = (userId) => {
  const token = jwt.sign({ userId, tokenType: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
  const refreshToken = jwt.sign({ userId, tokenType: "refresh", nonce: crypto.randomUUID() }, process.env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  return { token, refreshToken };
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
};

const setCsrfCookie = (res, csrfToken) => {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
};

const clearAuthCookies = (res) => {
  const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  };
  res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieOptions, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...cookieOptions, httpOnly: false });
};

const generateCsrfToken = () => crypto.randomBytes(32).toString("hex");

const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!target) {
    return null;
  }

  return decodeURIComponent(target.slice(name.length + 1));
};

// ================= REGISTER =================
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("User already exists", 400));
    }

    const user = await User.create({ name, email, password });
    const { token, refreshToken } = generateTokens(user._id);
    const csrfToken = generateCsrfToken();

    user.refreshToken = refreshToken;
    await user.save();
    setRefreshCookie(res, refreshToken);
    setCsrfCookie(res, csrfToken);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= LOGIN =================
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new AppError("Account not found. Please register to initialize your terminal.", 401));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError("Invalid credentials", 401));
    }

    const { token, refreshToken } = generateTokens(user._id);
    const csrfToken = generateCsrfToken();
    user.refreshToken = refreshToken;
    await user.save();
    setRefreshCookie(res, refreshToken);
    setCsrfCookie(res, csrfToken);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================= REFRESH =================
const refresh = async (req, res, next) => {
  try {
    const refreshToken = getCookieValue(req.headers.cookie, REFRESH_COOKIE_NAME);
    const csrfTokenCookie = getCookieValue(req.headers.cookie, CSRF_COOKIE_NAME);
    const csrfHeader = req.headers["x-csrf-token"];

    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 401));
    }

    if (!csrfHeader || !csrfTokenCookie || csrfHeader !== csrfTokenCookie) {
      if (process.env.NODE_ENV === "production") {
        return next(new AppError("CSRF_TOKEN_INVALID", 403));
      } else {
        console.warn(`[CSRF_WARNING] Potential CSRF mismatch ignored in ${process.env.NODE_ENV} mode.`);
      }
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.tokenType !== "refresh") {
      return next(new AppError("Invalid token type for refresh", 401));
    }

    const user = await User.findOne({ _id: decoded.userId, refreshToken }).select("+refreshToken");

    if (!user) {
      return next(new AppError("Invalid refresh token", 401));
    }

    const tokens = generateTokens(user._id);
    const csrfToken = generateCsrfToken();
    user.refreshToken = tokens.refreshToken;
    await user.save();
    setRefreshCookie(res, tokens.refreshToken);
    setCsrfCookie(res, csrfToken);

    res.status(200).json({
      success: true,
      token: tokens.token,
    });
  } catch (error) {
    return next(new AppError("Invalid or expired refresh token", 401));
  }
};

const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+refreshToken");
    if (!user) {
      return next(new AppError("Not authorized, user not found", 401));
    }

    user.refreshToken = undefined;
    await user.save();

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "LOGOUT_SUCCESS",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
};
