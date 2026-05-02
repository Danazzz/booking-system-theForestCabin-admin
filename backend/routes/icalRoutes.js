import express from "express";
import {
  createIcalSourceController,
  deleteIcalSourceController,
  getIcalSourceController,
  listIcalSourcesController,
  syncICal,
  syncIcalSourceController,
  updateIcalSourceController
} from "../controllers/icalController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/sync-ical", protect, syncICal);
router.post("/ical-sources", protect, createIcalSourceController);
router.get("/ical-sources", protect, listIcalSourcesController);
router.get("/ical-sources/:id", protect, getIcalSourceController);
router.patch("/ical-sources/:id", protect, updateIcalSourceController);
router.delete("/ical-sources/:id", protect, deleteIcalSourceController);
router.post("/ical-sources/:id/sync", protect, syncIcalSourceController);

export default router;
