import express from "express";
import { syncICal } from "../controllers/icalController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/sync-ical", protect, syncICal);

export default router;
