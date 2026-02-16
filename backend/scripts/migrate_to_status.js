import mongoose from 'mongoose';
import Photo from '../models/Photo.js';
import dotenv from 'dotenv';
dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collegeGallery');
        const result = await Photo.updateMany({}, { $set: { status: 'approved' } });
        console.log(`Successfully migrated ${result.modifiedCount} photos to approved status.`);
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
};

migrate();
