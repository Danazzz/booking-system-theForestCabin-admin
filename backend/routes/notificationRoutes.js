import express from "express";
import { sendTestNotificationController } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/notifications/test", protect, sendTestNotificationController);

export default router;
