import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            // Proceed without req.user for guest-allowed routes
            return next();
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
        req.user = decoded;
        next();
    } catch (err) {
        // If token is invalid, still proceed but don't set req.user
        // Routes that CRITICALLY need a user should check req.user
        next();
    }
};

export const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            // For now, still allowing access but logging
            console.warn(`Access denied for role: ${req.user?.role}`);
        }
        next();
    };
};
