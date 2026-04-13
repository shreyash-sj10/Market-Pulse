const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.tokenType !== "access") {
        return next(new AppError("Not authorized, invalid token type", 401));
      }

      req.user = await User.findById(decoded.userId).select("-password");
      if (!req.user) {
        return next(new AppError("Not authorized, user not found", 401));
      }

      return next();
    } catch (error) {
      return next(new AppError("Not authorized, token failed", 401));
    }
  }

  if (!token) {
    return next(new AppError("Not authorized, token missing", 401));
  }
};

module.exports = protect;
