import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String },
    role: { type: String, enum: ["student", "admin", "mentor"], default: "student" },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
