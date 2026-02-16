import mongoose from "mongoose";
import Photo from "./models/Photo.js";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collegegallery");
        console.log("Connected to MongoDB");

        const photos = await Photo.find();
        console.log(`Found ${photos.length} photos.`);

        photos.forEach(p => {
            console.log(`ID: ${p._id}`);
            console.log(`Title: ${p.title}`);
            console.log(`Image URL: ${p.imageUrl}`);
            console.log(`Thumbnail URL: ${p.thumbnailUrl}`);
            console.log("-------------------");
        });

        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
};

run();
