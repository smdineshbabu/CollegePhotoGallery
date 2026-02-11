const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploaderRole: {
      type: String,
      enum: ["student", "mentor", "admin"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Photo", photoSchema);
