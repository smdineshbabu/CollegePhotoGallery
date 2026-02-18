import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    photo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Photo"
    },
    message: {
        type: String,
        required: true
    },
    adminResponse: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'ignored'],
        default: 'pending'
    },
    type: {
        type: String,
        enum: ['deletion', 'general'],
        default: 'general'
    }
}, { timestamps: true });

export default mongoose.model("Request", requestSchema);
