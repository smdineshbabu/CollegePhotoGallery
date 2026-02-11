const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const Photo = require("../models/Photo");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

/**
 * POST /api/photos/upload
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const photo = await Photo.create({
        filename: req.file.filename,
        path: req.file.path,
        uploadedBy: req.user.id,
        uploaderRole: req.user.role,
      });

      res.status(201).json({
        message: "File uploaded successfully",
        photo,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/photos (ADMIN ONLY)
 */
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const photos = await Photo.find()
        .sort({ createdAt: -1 })
        .populate("uploadedBy", "name email role");

      res.json(photos);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
