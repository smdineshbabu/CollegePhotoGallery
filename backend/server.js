const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 THIS LINE IS CRITICAL
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/photos", require("./routes/photoRoutes"));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
