const mongoose = require("mongoose");
const Photo = require("./models/Photo.js"); // Adjust path if needed
const dotenv = require("dotenv");

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collegeGallery");
        console.log("Connected to MongoDB");

        // Need to define schema if loading model directly doesn't work with require in this context due to ES modules
        // But since project use ES modules (import), I should probably use .mjs or ensure I can import.
        // Let's try to assume commonjs for this script or use dynamic import.

        // Actually, the project uses type: "module" in package.json potentially.
        // Let's check package.json first.
    } catch (err) {
        console.error(err);
    }
};
