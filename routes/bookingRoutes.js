import express from "express";
import {
  createBookingController,
  getAvailabilityController,
  listBookingsController,
  syncController
} from "../controllers/bookingController.js";

const router = express.Router();

router.post("/booking", createBookingController);
router.get("/availability", getAvailabilityController);
router.post("/sync", syncController);
router.get("/bookings", listBookingsController);

export default router;
