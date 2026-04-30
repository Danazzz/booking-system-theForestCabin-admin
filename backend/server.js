import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import icalRoutes from "./routes/icalRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import channelRoutes from "./routes/channelRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { startSyncJob } from "./jobs/syncJob.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  return (
    allowedOrigins.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):51\d{2}$/.test(origin)
  );
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin || isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin || allowedOrigins[0]);
  }

  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.json());
app.use("/", authRoutes);
app.use("/", icalRoutes);
app.use("/", bookingRoutes);
app.use("/", roomRoutes);
app.use("/", channelRoutes);
app.use("/", alertRoutes);
app.use("/", configRoutes);
app.use("/api", authRoutes);
app.use("/api", bookingRoutes);
app.use("/api", roomRoutes);
app.use("/api", channelRoutes);
app.use("/api", icalRoutes);
app.use("/api", alertRoutes);
app.use("/api", configRoutes);

connectDB().then(() => {
  startSyncJob();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

app.get("/", (req, res) => {
  res.send("API running");
});
