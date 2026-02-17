import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import os from "os";
import { fileURLToPath } from "url";
import Photo from "../models/Photo.js";
import { auth, checkRole } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get server IP address
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
console.log(`Server IP for photo URLs: ${serverIP}`);

// Configure Multer for Image storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Error: File upload only supports images!"));
  }
});

router.post("/", auth, upload.array("photos", 10), async (req, res) => {
  try {
    const rawTitles = req.body.titles;
    const singleTitle = req.body.title;
    const folder = req.body.folder || "General";

    let titles = [];
    if (rawTitles) {
      try {
        titles = JSON.parse(rawTitles);
      } catch (e) {
        console.error("Error parsing titles JSON:", e);
        titles = [rawTitles]; // Fallback if it's just a string
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const savedPhotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const thumbnailName = `thumb_${file.filename}`;
      const thumbnailPath = path.join("uploads", thumbnailName);

      await sharp(file.path)
        .resize(400)
        .toFile(thumbnailPath);

      const thumbnailUrl = `/uploads/${thumbnailName}`;

      // Use titles[i] if available, then singleTitle, then default
      const photoTitle = (titles && titles[i]) || singleTitle || "Uploaded Memory";

      const newPhoto = new Photo({
        title: photoTitle,
        imageUrl: `/uploads/${file.filename}`,
        thumbnailUrl: thumbnailUrl,
        folder: folder
      });
      await newPhoto.save();
      savedPhotos.push(newPhoto);
    }

    res.status(201).json(savedPhotos);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Failed to upload files" });
  }
});

// GET all photos (all statuses, app will handle display logic)
router.get("/", async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET pending photos (admin only)
router.get("/pending", auth, async (req, res) => {
  try {
    const photos = await Photo.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// APPROVE a photo (admin only)
router.patch("/approve/:id", auth, async (req, res) => {
  try {
    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    res.json({ message: "Photo approved successfully", photo });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve photo" });
  }
});

// REJECT a photo (admin only)
router.patch("/reject/:id", auth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', rejectionReason: rejectionReason || "No reason provided" },
      { new: true }
    );
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    res.json({ message: "Photo rejected successfully", photo });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject photo" });
  }
});

// DELETE a photo
router.delete("/:id", auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Extract filenames from URLs
    const filenames = [
      photo.imageUrl?.split("/uploads/")[1],
      photo.thumbnailUrl?.split("/uploads/")[1]
    ].filter(Boolean);

    filenames.forEach(filename => {
      const filePath = path.join(__dirname, "../uploads", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await Photo.findByIdAndDelete(req.params.id);
    res.json({ message: "Photo deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// DELETE an entire folder
router.delete("/folder/:name", auth, async (req, res) => {
  try {
    const { name } = req.params;
    const photos = await Photo.find({ folder: name });

    if (photos.length === 0) {
      return res.status(404).json({ message: "No photos found in this folder" });
    }

    // Delete all files
    photos.forEach(photo => {
      const filenames = [
        photo.imageUrl?.split("/uploads/")[1],
        photo.thumbnailUrl?.split("/uploads/")[1]
      ].filter(Boolean);

      filenames.forEach(filename => {
        const filePath = path.join(__dirname, "../uploads", filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });

    // Delete from DB
    await Photo.deleteMany({ folder: name });

    res.json({ message: `Folder '${name}' and all contents deleted successfully` });
  } catch (err) {
    console.error("Folder delete error:", err);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

// Increment view count
router.patch("/:id/view", async (req, res) => {
  try {
    const photo = await Photo.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    res.json({ views: photo.views });
  } catch (err) {
    res.status(500).json({ error: "Failed to update views" });
  }
});

// Update photo metadata
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, folder } = req.body;

  console.log(`[PATCH] Updating photo ${id}:`, { title, folder });

  try {
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (folder !== undefined) updateData.folder = folder;

    const photo = await Photo.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!photo) {
      console.log(`[PATCH] Photo not found: ${id}`);
      return res.status(404).json({ error: "Photo not found" });
    }

    console.log(`[PATCH] Successfully updated photo: ${id}`);
    res.json(photo);
  } catch (err) {
    console.error(`[PATCH] Update error for ${id}:`, err);
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "Invalid photo ID format" });
    }
    res.status(500).json({ error: "Failed to update photo on server" });
  }
});

// Rename an entire folder (updates all photos in that folder)
router.patch("/folder/rename", auth, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: "Old and new names are required" });
    }

    const result = await Photo.updateMany(
      { folder: oldName },
      { $set: { folder: newName } }
    );

    res.json({
      message: `Successfully renamed folder from '${oldName}' to '${newName}'`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Folder rename error:", err);
    res.status(500).json({ error: "Failed to rename folder" });
  }
});

export default router;
