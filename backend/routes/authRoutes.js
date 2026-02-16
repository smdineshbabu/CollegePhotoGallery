import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// Signup Route
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || "student",
        });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        res.status(201).json({
            token,
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Something went wrong" });
    }
});

// Login Route
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User doesn't exist" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "7d" }
        );

        res.status(200).json({
            token,
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Something went wrong" });
    }
});

export default router;
