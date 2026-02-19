import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  imageUrl: String,
  title: String,
  folder: {
    type: String,
    default: "General",
    required: true,
  },
  views: {
    type: Number,
    default: 0,
  },
  uploadedBy: {
    type: String,
    default: "Guest"
  },
  thumbnailUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ""
  },
  likes: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  viewedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: []
  }
}, { timestamps: true });

photoSchema.index({ status: 1, createdAt: -1 });
photoSchema.index({ views: -1 });
photoSchema.index({ folder: 1 });

export default mongoose.model("Photo", photoSchema);
