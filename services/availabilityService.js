import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";
import { BookingConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";

export const parseStayDates = ({ checkIn, checkOut }) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ValidationError("checkIn and checkOut must be valid dates");
  }

  if (start >= end) {
    throw new ValidationError("checkOut must be after checkIn");
  }

  return { checkIn: start, checkOut: end };
};

export const getAvailability = async ({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  excludeBookingId = null
}) => {
  if (!mongoose.Types.ObjectId.isValid(propertyId) || !mongoose.Types.ObjectId.isValid(roomId)) {
    throw new ValidationError("propertyId and roomId must be valid MongoDB ObjectIds");
  }

  const propertyObjectId = new mongoose.Types.ObjectId(propertyId);
  const roomObjectId = new mongoose.Types.ObjectId(roomId);

  const room = await Room.findOne({
    _id: roomObjectId,
    propertyId: propertyObjectId,
    isActive: true
  });

  if (!room) {
    throw new NotFoundError("Room not found for this property");
  }

  const overlapQuery = {
    propertyId: propertyObjectId,
    roomId: roomObjectId,
    status: "confirmed",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn }
  };

  if (excludeBookingId) {
    if (!mongoose.Types.ObjectId.isValid(excludeBookingId)) {
      throw new ValidationError("excludeBookingId must be a valid MongoDB ObjectId");
    }

    overlapQuery._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const [usage] = await Booking.aggregate([
    { $match: overlapQuery },
    { $group: { _id: null, bookedRooms: { $sum: "$roomCount" } } }
  ]);

  const bookedRooms = usage?.bookedRooms || 0;
  const availableRooms = Math.max(room.totalUnits - bookedRooms, 0);

  return {
    propertyId,
    roomId,
    roomName: room.name,
    totalRooms: room.totalUnits,
    bookedRooms,
    availableRooms,
    checkIn,
    checkOut
  };
};

export const ensureAvailability = async ({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  roomCount,
  excludeBookingId = null
}) => {
  if (!Number.isInteger(roomCount) || roomCount < 1) {
    throw new ValidationError("roomCount must be a positive integer");
  }

  const availability = await getAvailability({
    propertyId,
    roomId,
    checkIn,
    checkOut,
    excludeBookingId
  });

  if (roomCount > availability.availableRooms) {
    throw new BookingConflictError(
      "Not enough rooms available for the requested dates",
      {
        requestedRooms: roomCount,
        availableRooms: availability.availableRooms,
        totalRooms: availability.totalRooms,
        bookedRooms: availability.bookedRooms
      }
    );
  }

  return availability;
};
