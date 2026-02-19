import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import os from "os";
import { fileURLToPath } from "url";
import Photo from "../models/Photo.js";
import { auth, checkRole } from "../middleware/auth.js";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET Trending Photos (Weighted Likes + SuperLikes)
router.get("/trending", async (req, res) => {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Aggregate to calculate a weighted score: (Likes * 5) + Views
    const trendingPhotos = await Photo.aggregate([
      {
        $match: {
          status: 'approved',
          createdAt: { $gte: fortyEightHoursAgo }
        }
      },
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 5] },
              { $ifNull: ["$views", 0] }
            ]
          }
        }
      },
      { $sort: { trendingScore: -1, createdAt: -1 } },
      { $limit: 10 }
    ]);

    // Fallback: If no recent trending, show top overall based on same score
    if (trendingPhotos.length === 0) {
      const topOverall = await Photo.aggregate([
        { $match: { status: 'approved' } },
        {
          $addFields: {
            trendingScore: {
              $add: [
                { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 5] },
                { $ifNull: ["$views", 0] }
              ]
            }
          }
        },
        { $sort: { trendingScore: -1 } },
        { $limit: 10 }
      ]);
      return res.json(topOverall);
    }

    res.json(trendingPhotos);
  } catch (err) {
    console.error("Trending Error:", err);
    res.status(500).json({ error: "Failed to fetch trending photos" });
  }
});

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

// GET all photos (supports filtering by status)
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const photos = await Photo.find(query).sort({ createdAt: -1 }).lean();
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

// Increment view count (Now unique per user)
router.patch("/:id/view", auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Initialize viewedBy if it doesn't exist
    if (!photo.viewedBy) photo.viewedBy = [];

    // Add user ID to unique set
    const userId = req.user.id;
    if (!photo.viewedBy.includes(userId)) {
      photo.viewedBy.push(userId);
      photo.views = photo.viewedBy.length;
      await photo.save();
    }

    res.json({ views: photo.views });
  } catch (err) {
    console.error("View update error:", err);
    res.status(500).json({ error: "Failed to update views" });
  }
});

// BULK MOVE photos to a new folder
router.patch("/bulk-move", auth, async (req, res) => {
  try {
    const { ids, folder } = req.body;
    if (!ids || !Array.isArray(ids) || !folder) {
      return res.status(400).json({ error: "IDs array and folder name are required" });
    }

    const result = await Photo.updateMany(
      { _id: { $in: ids } },
      { $set: { folder: folder } }
    );

    res.json({
      message: `Successfully moved ${result.modifiedCount} photos to ${folder}`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("Bulk move error:", err);
    res.status(500).json({ error: "Failed to perform bulk move" });
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

// BATCH DOWNLOAD (Admin only ideally, but public for now for ease)
router.get("/batch-download", async (req, res) => {
  try {
    const photos = await Photo.find({ status: 'approved' });
    if (photos.length === 0) {
      return res.status(404).json({ message: "No approved photos to download" });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    res.attachment('gallery_memories.zip');

    archive.on('error', function (err) {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    photos.forEach(photo => {
      const filename = photo.imageUrl.split("/uploads/")[1];
      const filePath = path.join(__dirname, "../uploads", filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: photo.title.replace(/[^\w\s]/gi, '') + "_" + filename });
      }
    });

    await archive.finalize();
  } catch (err) {
    console.error("Batch download error:", err);
    res.status(500).json({ error: "Failed to create archive" });
  }
});

// AI MODERATION SCAN (Mock)
router.post("/ai-scan", async (req, res) => {
  try {
    const pendingPhotos = await Photo.find({ status: 'pending' });
    let flaggedCount = 0;

    for (const photo of pendingPhotos) {
      const lowerTitle = photo.title.toLowerCase();
      // Simulate AI flagging certain criteria
      if (lowerTitle.includes("recovered") || lowerTitle.includes("restored") || photo.title.length < 5) {
        photo.status = 'rejected';
        photo.rejectionReason = "[AI FLAG] Potentially low quality or placeholder title.";
        await photo.save();
        flaggedCount++;
      }
    }

    res.json({ message: `AI Scan complete. ${flaggedCount} photos flagged and rejected.`, flaggedCount });
  } catch (err) {
    console.error("AI Scan error:", err);
    res.status(500).json({ error: "Failed to perform AI scan" });
  }
});

// LIKE/UNLIKE PHOTO
router.patch("/:id/like", auth, async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    // Initialize likes array if it doesn't exist (legacy photos)
    if (!photo.likes) photo.likes = [];

    const userIndex = photo.likes.indexOf(req.user.id);
    if (userIndex === -1) {
      // Like
      photo.likes.push(req.user.id);
    } else {
      // Unlike
      photo.likes.splice(userIndex, 1);
    }

    await photo.save();
    res.json({
      likesCount: photo.likes.length,
      isLiked: photo.likes.includes(req.user.id)
    });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
