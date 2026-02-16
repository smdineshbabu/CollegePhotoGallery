import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Photo from './models/Photo.js';
import os from 'os';

// Get server IP
function getServerIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const serverIP = getServerIP();

// Connect to MongoDB - using CollegeGallery to match existing DB casing
mongoose.connect('mongodb://127.0.0.1:27017/CollegeGallery')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

async function importPhotos() {
    try {
        const uploadsDir = './uploads';
        const files = fs.readdirSync(uploadsDir);

        // Filter only image files (not thumbnails)
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return (ext === '.jpg' || ext === '.jpeg' || ext === '.png') && !file.startsWith('thumb_');
        });

        console.log(`Found ${imageFiles.length} images in uploads folder`);

        let imported = 0;
        for (const filename of imageFiles) {
            try {
                const imageUrl = `http://${serverIP}:5000/uploads/${filename}`;
                const thumbnailName = `thumb_${filename}`;
                const thumbnailUrl = `http://${serverIP}:5000/uploads/${thumbnailName}`;

                // Check if this photo already exists in database
                const existing = await Photo.findOne({ imageUrl });
                if (existing) {
                    console.log(`Skipping ${filename} - already in database`);
                    continue;
                }

                // Create photo record
                const photo = new Photo({
                    title: `Photo ${filename.split('.')[0]}`,
                    imageUrl: imageUrl,
                    thumbnailUrl: fs.existsSync(path.join(uploadsDir, thumbnailName)) ? thumbnailUrl : imageUrl,
                    folder: 'General',
                    views: 0
                });

                await photo.save();
                imported++;
                console.log(`Imported: ${filename}`);
            } catch (err) {
                console.error(`Failed to import ${filename}:`, err.message);
            }
        }

        console.log(`\n✅ Successfully imported ${imported} photos!`);
        console.log(`Total photos in database: ${await Photo.countDocuments()}`);

        process.exit(0);
    } catch (error) {
        console.error('Error importing photos:', error);
        process.exit(1);
    }
}

importPhotos();
