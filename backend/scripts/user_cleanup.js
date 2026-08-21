import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Photo from '../models/Photo.js';
import Request from '../models/Request.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

async function cleanup() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect('mongodb://127.0.0.1:27017/collegegallery');
        console.log('Connected.');

        // Delete Database entries
        console.log('Deleting photos from database...');
        const photoResult = await Photo.deleteMany({});
        console.log(`Deleted ${photoResult.deletedCount} photos.`);

        console.log('Deleting requests from database...');
        const requestResult = await Request.deleteMany({});
        console.log(`Deleted ${requestResult.deletedCount} requests.`);

        // Delete Files
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            let fileCount = 0;
            for (const file of files) {
                if (file !== '.gitignore') {
                    fs.unlinkSync(path.join(uploadsDir, file));
                    fileCount++;
                }
            }
            console.log(`Deleted ${fileCount} files from uploads directory.`);
        }

        console.log('-----------------------------------');
        console.log('🚀 CLEANUP COMPLETE: Fresh start ready!');
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Cleanup error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

cleanup();
