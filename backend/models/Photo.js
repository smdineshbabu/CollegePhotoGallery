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
  thumbnailUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });


export default mongoose.model("Photo", photoSchema);
