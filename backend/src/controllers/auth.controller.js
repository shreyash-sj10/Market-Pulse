const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

const generateTokens = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15m", // Short-lived access token
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Long-lived refresh token
  });
  return { token, refreshToken };
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

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      token,
      refreshToken,
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
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      token,
      refreshToken,
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
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 401));
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, refreshToken }).select("+refreshToken");

    if (!user) {
      return next(new AppError("Invalid refresh token", 401));
    }

    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    return next(new AppError("Invalid or expired refresh token", 401));
  }
};

module.exports = {
  register,
  login,
  refresh,
};
