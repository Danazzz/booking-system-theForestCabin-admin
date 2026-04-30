import express from "express";
import { syncICal } from "../controllers/icalController.js";

const router = express.Router();

router.post("/sync-ical", syncICal);

export default router;