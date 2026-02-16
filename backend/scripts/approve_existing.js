import mongoose from 'mongoose';
import Photo from '../models/Photo.js';
import dotenv from 'dotenv';
dotenv.config();

const approveAll = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collegeGallery');
        const result = await Photo.updateMany({}, { $set: { isApproved: true } });
        console.log(`Successfully approved ${result.modifiedCount} existing photos.`);
        process.exit(0);
    } catch (err) {
        console.error("Error approving photos:", err);
        process.exit(1);
    }
};

approveAll();
