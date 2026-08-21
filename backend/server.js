import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import uploadRoutes from "./routes/uploadRoutes.js";
import authRoutes from "./routes/authRoutes.js"; // Assuming you have auth routes
import requestRoutes from "./routes/requestRoutes.js";
import dotenv from "dotenv";
import os from "os";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAllServerIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 and skip internal (127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

const app = express();

// Nuclear CORS - Manually set headers on every response
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, bypass-tunnel-reminder");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Global request logger for debugging
app.use((req, res, next) => {
  const ua = req.get('User-Agent') || 'Unknown UA';
  console.log(`[DEBUG] ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  console.log(`[DEBUG] From: ${req.ip} | UA: ${ua}`);

  if (req.method === 'OPTIONS') {
    console.log(`[DEBUG] Preflight (CORS) detected from ${req.ip}`);
  }
  next();
});

// Ultra-fast ping test
app.get("/api/ping", (req, res) => res.json({ status: "ok", time: new Date() }));
app.get("/", (req, res) => res.json({ status: "ok", app: "College Photo Gallery" }));

// Test route to verify server is reachable
app.get("/test", (req, res) => res.json({ status: "ok", message: "Server is reachable!" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "bypass-tunnel-reminder");
  }
}));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/collegeGallery")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));


// Redundant routes for typo-tolerance
app.use("/api/upload", uploadRoutes);
app.use("/upload", uploadRoutes);
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/requests", requestRoutes);

// Catch-all 404 logger
app.use((req, res) => {
  console.log(`[404 NOT FOUND] ${req.method} ${req.url} from ${req.ip}`);
  res.status(404).json({ error: "Route not found", url: req.url, method: req.method });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  const ips = getAllServerIPs();
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Available on your network at:`);
  ips.forEach(ip => {
    console.log(`  - http://${ip}:${PORT}`);
  });
  console.log(`\n---------------------------------------------------------`);
  console.log(`📡 CONNECTING YOUR PHONE:`);
  console.log(`1. Ensure your phone is on the SAME WiFi/Hotspot.`);
  console.log(`2. Open App -> Settings (Gear Icon).`);
  console.log(`3. Enter one of the URLs above (usually the 192.168... or 10.73... one).`);
  console.log(`---------------------------------------------------------\n`);
});
