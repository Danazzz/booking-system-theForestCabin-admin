import { getAvailability, parseStayDates } from "../services/availabilityService.js";
import {
  createBooking,
  listBookings,
  syncExternalBookings
} from "../services/bookingService.js";

const sendError = (res, error) => {
  res.status(error.statusCode || 500).json({
    error: error.message,
    details: error.details
  });
};

export const createBookingController = async (req, res) => {
  try {
    const booking = await createBooking(req.body);

    res.status(201).json({
      message: "Booking confirmed",
      data: booking
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getAvailabilityController = async (req, res) => {
  try {
    const { propertyId, roomId, checkIn, checkOut } = req.query;
    const stayDates = parseStayDates({ checkIn, checkOut });
    const availability = await getAvailability({
      propertyId,
      roomId,
      ...stayDates
    });

    res.json({ data: availability });
  } catch (error) {
    sendError(res, error);
  }
};

export const syncController = async (req, res) => {
  try {
    const result = await syncExternalBookings(req.body);

    res.json({
      message: "Sync completed",
      ...result
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const listBookingsController = async (req, res) => {
  try {
    const bookings = await listBookings(req.query);

    res.json({ data: bookings });
  } catch (error) {
    sendError(res, error);
  }
};
