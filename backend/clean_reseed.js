import mongoose from "mongoose";
import Photo from "./models/Photo.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collegeGallery");

        console.log("NUKING existing photo records...");
        await Photo.deleteMany({});

        const uploadsDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadsDir)) {
            console.error("Uploads directory NOT FOUND!");
            process.exit(1);
        }

        const files = fs.readdirSync(uploadsDir);
        console.log(`Found ${files.length} files in uploads folder.`);

        for (const file of files) {
            // Only process actual images (skip thumbnails for the main list, we'll auto-link them)
            if (file.startsWith("thumb_")) continue;
            if (!file.match(/\.(jpg|jpeg|png)$/i)) continue;

            const thumbName = `thumb_${file}`;
            const hasThumb = fs.existsSync(path.join(uploadsDir, thumbName));

            const newPhoto = new Photo({
                title: "Imported Memory",
                folder: "General",
                imageUrl: `/uploads/${file}`,
                thumbnailUrl: hasThumb ? `/uploads/${thumbName}` : `/uploads/${file}`,
                views: Math.floor(Math.random() * 50)
            });

            await newPhoto.save();
            console.log(`Saved: ${file}`);
        }

        console.log("DONE! Database is now clean and synchronized with your uploads folder.");
        mongoose.disconnect();
    } catch (err) {
        console.error("ERROR:", err);
    }
};

run();
