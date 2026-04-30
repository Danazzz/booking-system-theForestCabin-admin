import express from "express";
import {
  createRoomController,
  deleteRoomController,
  getRoomController,
  listRoomsController,
  updateRoomController
} from "../controllers/roomController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/rooms", protect, createRoomController);
router.get("/rooms", protect, listRoomsController);
router.get("/rooms/:id", protect, getRoomController);
router.patch("/rooms/:id", protect, updateRoomController);
router.delete("/rooms/:id", protect, deleteRoomController);

export default router;
