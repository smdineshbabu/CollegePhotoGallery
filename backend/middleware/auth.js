import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
    // Disabled for simplified guest access
    next();
};

export const checkRole = (roles) => {
    return (req, res, next) => {
        // Disabled for simplified setup - all users have access
        next();
    };
};
