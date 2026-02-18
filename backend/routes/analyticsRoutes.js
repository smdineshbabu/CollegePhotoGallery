import express from "express";
import Photo from "../models/Photo.js";

const router = express.Router();

// GET gallery analytics
router.get("/", async (req, res) => {
    try {
        // 1. Views per Folder
        const viewsByFolder = await Photo.aggregate([
            { $group: { _id: "$folder", totalViews: { $sum: "$views" }, count: { $sum: 1 } } },
            { $sort: { totalViews: -1 } }
        ]);

        // 2. Status Distribution
        const statusDistribution = await Photo.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        // 3. Top 5 Most Viewed Photos
        const topPhotos = await Photo.find({ status: 'approved' })
            .sort({ views: -1 })
            .limit(5)
            .select('title views folder imageUrl');

        // 4. Overall Stats
        const totalViews = await Photo.aggregate([
            { $group: { _id: null, total: { $sum: "$views" } } }
        ]);

        const totalPhotos = await Photo.countDocuments();

        res.json({
            viewsByFolder: viewsByFolder.map(f => ({ name: f._id, views: f.totalViews, count: f.count })),
            statusDistribution: statusDistribution.map(s => ({ name: s._id, value: s.count })),
            topPhotos,
            summary: {
                totalViews: totalViews[0]?.total || 0,
                totalPhotos
            }
        });

    } catch (err) {
        console.error("Analytics Error:", err);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

export default router;
