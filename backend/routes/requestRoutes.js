import express from "express";
import Request from "../models/Request.js";
import { auth, checkRole } from "../middleware/auth.js";

const router = express.Router();

// Submit a new request
router.post("/", auth, async (req, res) => {
    try {
        const { photoId, message, type } = req.body;
        const newRequest = new Request({
            user: req.user.id,
            photo: photoId,
            message,
            type: type || 'general'
        });
        await newRequest.save();
        res.status(201).json(newRequest);
    } catch (err) {
        console.error("Error creating request:", err.message || err);
        res.status(500).json({ message: "Failed to create request", detail: err.message });
    }
});

// Submit a bulk delete request
router.post("/bulk-delete", auth, async (req, res) => {
    try {
        const { photoIds, message } = req.body;
        if (!photoIds || !Array.isArray(photoIds)) {
            return res.status(400).json({ message: "Photo IDs array is required" });
        }

        const requests = photoIds.map(id => ({
            user: req.user.id,
            photo: id,
            message: message || "Bulk deletion request.",
            type: 'deletion'
        }));

        const result = await Request.insertMany(requests);
        res.status(201).json({
            message: `Created ${result.length} deletion requests.`,
            count: result.length
        });
    } catch (err) {
        console.error("Bulk delete request error:", err);
        res.status(500).json({ message: "Failed to create bulk requests" });
    }
});

// List all requests (Admin)
router.get("/", auth, async (req, res) => {
    try {
        const requests = await Request.find()
            .populate("user", "name email")
            .populate("photo", "title imageUrl")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch requests" });
    }
});

// List user's own requests
router.get("/my", auth, async (req, res) => {
    try {
        const requests = await Request.find({ user: req.user.id })
            .populate("photo", "title imageUrl")
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch your requests" });
    }
});

// Admin responds/resolves a request
router.patch("/:id", auth, async (req, res) => {
    try {
        const { adminResponse, status } = req.body;
        const request = await Request.findByIdAndUpdate(
            req.params.id,
            { adminResponse, status: status || 'resolved' },
            { new: true }
        );
        if (!request) return res.status(404).json({ message: "Request not found" });
        res.json(request);
    } catch (err) {
        res.status(500).json({ message: "Failed to update request" });
    }
});

export default router;
