const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const AppError = require("../utils/AppError");

const protect = async (req, res, next) => {
    let token;
    
    console.log("=== INCOMING HEADERS IN PROTECT ===");
    console.log(req.headers);

    // 1. Check for Token in Headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header: "Bearer <token>"
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify Token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Attach User to Request (exclude password)
            // Note: used decoded.userId here instead of decoded.id to match the JWT sign payload in auth.controller.js
            req.user = await User.findById(decoded.userId).select('-password');
            
            return next();
        } catch (error) {
            return next(new AppError('Not authorized, token failed', 401));
        }
    }

    // 4. Triggered if no token is found (Your current error location)
    if (!token) {
        return next(new AppError('Not authorized, token missing', 401));
    }
};

module.exports = protect;
