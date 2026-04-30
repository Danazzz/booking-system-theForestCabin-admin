import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import { ConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";

const roomFields = [
  "propertyId",
  "name",
  "code",
  "totalUnits",
  "maxGuestsPerUnit",
  "isActive"
];

const updateFields = [
  "name",
  "code",
  "totalUnits",
  "maxGuestsPerUnit",
  "isActive"
];

const validateObjectId = (id, fieldName = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} must be a valid MongoDB ObjectId`);
  }
};

const pickFields = (payload, fields) => {
  const data = {};

  for (const field of fields) {
    if (payload[field] !== undefined) {
      data[field] = payload[field];
    }
  }

  return data;
};

const handleDuplicateRoom = (error) => {
  if (error.code === 11000) {
    throw new ConflictError("Room code already exists for this property", error.keyValue);
  }

  throw error;
};

export const createRoom = async (payload) => {
  const data = pickFields(payload, roomFields);

  if (!data.name || !data.code || data.totalUnits === undefined) {
    throw new ValidationError("name, code, and totalUnits are required");
  }

  if (data.propertyId) {
    validateObjectId(data.propertyId, "propertyId");
  }

  try {
    return await Room.create(data);
  } catch (error) {
    handleDuplicateRoom(error);
  }
};

export const listRooms = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) {
    validateObjectId(filters.propertyId, "propertyId");
    query.propertyId = filters.propertyId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true" || filters.isActive === true;
  }

  return Room.find(query).sort({ name: 1, createdAt: -1 });
};

export const getRoomById = async (roomId) => {
  validateObjectId(roomId, "roomId");

  const room = await Room.findById(roomId);

  if (!room) {
    throw new NotFoundError("Room not found");
  }

  return room;
};

export const updateRoom = async (roomId, payload) => {
  validateObjectId(roomId, "roomId");

  const updates = pickFields(payload, updateFields);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one room field is required");
  }

  try {
    const room = await Room.findByIdAndUpdate(
      roomId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!room) {
      throw new NotFoundError("Room not found");
    }

    return room;
  } catch (error) {
    handleDuplicateRoom(error);
  }
};

export const deleteRoom = async (roomId) => {
  validateObjectId(roomId, "roomId");

  const room = await Room.findById(roomId);

  if (!room) {
    throw new NotFoundError("Room not found");
  }

  const activeBookings = await Booking.countDocuments({
    roomId,
    status: { $in: ["pending", "confirmed"] }
  });

  if (activeBookings > 0) {
    throw new ConflictError("Room cannot be deleted while active bookings exist", {
      activeBookings
    });
  }

  room.isActive = false;
  return room.save();
};
