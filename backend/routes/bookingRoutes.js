import express from "express";
import {
  createBookingController,
  deleteBookingController,
  getBookingController,
  getAvailabilityController,
  listBookingsController,
  syncController,
  updateBookingController
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/booking", protect, createBookingController);
router.post("/bookings", protect, createBookingController);
router.get("/availability", protect, getAvailabilityController);
router.post("/sync", protect, syncController);
router.get("/bookings", protect, listBookingsController);
router.get("/bookings/:id", protect, getBookingController);
router.patch("/bookings/:id", protect, updateBookingController);
router.delete("/bookings/:id", protect, deleteBookingController);

export default router;
