import express from "express";
import {
  createChannelController,
  deleteChannelController,
  getChannelController,
  listChannelsController,
  updateChannelController
} from "../controllers/channelController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/channels", protect, createChannelController);
router.get("/channels", protect, listChannelsController);
router.get("/channels/:id", protect, getChannelController);
router.patch("/channels/:id", protect, updateChannelController);
router.delete("/channels/:id", protect, deleteChannelController);

export default router;
