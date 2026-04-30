import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import icalRoutes from "./routes/icalRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import { startSyncJob } from "./jobs/syncJob.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/", bookingRoutes);
app.use("/api", bookingRoutes);
app.use("/api", icalRoutes);

connectDB().then(() => {
  startSyncJob();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

app.get("/", (req, res) => {
  res.send("API running");
});
