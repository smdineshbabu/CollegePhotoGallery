import mongoose from 'mongoose';
import Photo from './models/Photo.js';

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/collegeGallery')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Create sample photos
const samplePhotos = [
    {
        title: 'College Fest 2024',
        imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400',
        folder: 'College Events',
        views: 0
    },
    {
        title: 'Sports Day',
        imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
        folder: 'Sports',
        views: 0
    },
    {
        title: 'Campus Library',
        imageUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800',
        thumbnailUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400',
        folder: 'Campus Life',
        views: 0
    }
];

async function seedDatabase() {
    try {
        // Clear existing photos
        await Photo.deleteMany({});
        console.log('Cleared existing photos');

        // Insert sample photos
        const inserted = await Photo.insertMany(samplePhotos);
        console.log(`Inserted ${inserted.length} sample photos`);
        console.log('Sample photos:', inserted.map(p => ({ title: p.title, folder: p.folder })));

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
