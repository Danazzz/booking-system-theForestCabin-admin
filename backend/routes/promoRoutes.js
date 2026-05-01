import express from "express";
import {
  createPromoController,
  deletePromoController,
  getPromoController,
  listPromosController,
  updatePromoController
} from "../controllers/promoController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/promos", protect, createPromoController);
router.get("/promos", protect, listPromosController);
router.get("/promos/:id", protect, getPromoController);
router.patch("/promos/:id", protect, updatePromoController);
router.delete("/promos/:id", protect, deletePromoController);

export default router;
