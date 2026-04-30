import express from "express";
import {
  getAlertsController,
  markAlertReadController
} from "../controllers/alertController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/alerts", protect, getAlertsController);
router.patch("/alerts/:id/read", protect, markAlertReadController);

export default router;
