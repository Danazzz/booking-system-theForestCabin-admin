import express from "express";
import {
  createConfigController,
  deleteConfigController,
  getConfigByIdController,
  getConfigController,
  listConfigsController,
  updateConfigByIdController,
  updateConfigController
} from "../controllers/configController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/config", protect, getConfigController);
router.patch("/config", protect, updateConfigController);
router.post("/configs", protect, createConfigController);
router.get("/configs", protect, listConfigsController);
router.get("/configs/:id", protect, getConfigByIdController);
router.patch("/configs/:id", protect, updateConfigByIdController);
router.delete("/configs/:id", protect, deleteConfigController);

export default router;
