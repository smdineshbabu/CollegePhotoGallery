import express from "express";
import Photo from "../models/Photo.js";

const router = express.Router();

// GET gallery analytics
router.get("/", async (req, res) => {
    try {
        const [viewsByFolder, statusDistribution, topPhotos, summaryStats] = await Promise.all([
            // 1. Views per Folder
            Photo.aggregate([
                { $group: { _id: "$folder", totalViews: { $sum: "$views" }, count: { $sum: 1 } } },
                { $sort: { totalViews: -1 } }
            ]),

            // 2. Status Distribution
            Photo.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // 3. Top 5 Most Viewed Photos
            Photo.find({ status: 'approved' })
                .sort({ views: -1 })
                .limit(5)
                .select('title views folder imageUrl')
                .lean(),

            // 4. Overall Stats (Combined into one aggregation)
            Photo.aggregate([
                {
                    $group: {
                        _id: null,
                        totalViews: { $sum: "$views" },
                        totalPhotos: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            viewsByFolder: viewsByFolder.map(f => ({ name: f._id || "General", views: f.totalViews, count: f.count })),
            statusDistribution: statusDistribution.map(s => ({ name: s._id, value: s.count })),
            topPhotos,
            summary: {
                totalViews: summaryStats[0]?.totalViews || 0,
                totalPhotos: summaryStats[0]?.totalPhotos || 0
            }
        });

    } catch (err) {
        console.error("Analytics Error:", err);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

export default router;
