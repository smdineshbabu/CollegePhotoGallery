import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Photo from "./models/Photo.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collegegallery");
        console.log("Connected to MongoDB");

        const uploadsDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadsDir)) {
            console.log("Uploads directory not found.");
            return;
        }

        const files = fs.readdirSync(uploadsDir);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file) && !file.startsWith("thumb_"));

        console.log(`Found ${imageFiles.length} image files in uploads folder.`);

        const existingPhotos = await Photo.find();
        const existingFilenames = new Set(existingPhotos.map(p => {
            // Handle both full URL and relative path to extract filename
            const url = p.imageUrl || "";
            return url.split("/uploads/").pop();
        }));

        let addedCount = 0;

        for (const file of imageFiles) {
            if (!existingFilenames.has(file)) {
                console.log(`Adding missing photo: ${file}`);

                // Check if a thumbnail exists
                const thumbName = `thumb_${file}`;
                const thumbPath = path.join(uploadsDir, thumbName);
                const hasThumb = fs.existsSync(thumbPath);

                const newPhoto = new Photo({
                    title: "Recovered Memory",
                    imageUrl: `/uploads/${file}`,
                    thumbnailUrl: hasThumb ? `/uploads/${thumbName}` : `/uploads/${file}`,
                    folder: "Recovered",
                    createdAt: new Date() // Or try to get file creation time
                });

                await newPhoto.save();
                addedCount++;
            }
        }

        console.log(`Successfully restored ${addedCount} photos to the database.`);

        mongoose.disconnect();
    } catch (err) {
        console.error("Error syncing photos:", err);
    }
};

run();
