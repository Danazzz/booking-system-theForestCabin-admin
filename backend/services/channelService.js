import mongoose from "mongoose";
import Channel from "../models/Channel.js";
import { ConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";

const channelFields = [
  "propertyId",
  "name",
  "type",
  "isActive"
];

const updateFields = [
  "name",
  "type",
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

const handleDuplicateChannel = (error) => {
  if (error.code === 11000) {
    throw new ConflictError("Channel already exists for this property", error.keyValue);
  }

  throw error;
};

export const createChannel = async (payload) => {
  const data = pickFields(payload, channelFields);

  if (!data.name || !data.type) {
    throw new ValidationError("name and type are required");
  }

  if (data.propertyId) {
    validateObjectId(data.propertyId, "propertyId");
  }

  try {
    return await Channel.create(data);
  } catch (error) {
    handleDuplicateChannel(error);
  }
};

export const listChannels = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) {
    validateObjectId(filters.propertyId, "propertyId");
    query.propertyId = filters.propertyId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true" || filters.isActive === true;
  }

  return Channel.find(query).sort({ name: 1, createdAt: -1 });
};

export const getChannelById = async (channelId) => {
  validateObjectId(channelId, "channelId");

  const channel = await Channel.findById(channelId);

  if (!channel) {
    throw new NotFoundError("Channel not found");
  }

  return channel;
};

export const updateChannel = async (channelId, payload) => {
  validateObjectId(channelId, "channelId");

  const updates = pickFields(payload, updateFields);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one channel field is required");
  }

  try {
    const channel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!channel) {
      throw new NotFoundError("Channel not found");
    }

    return channel;
  } catch (error) {
    handleDuplicateChannel(error);
  }
};

export const deleteChannel = async (channelId) => {
  validateObjectId(channelId, "channelId");

  const channel = await Channel.findByIdAndUpdate(
    channelId,
    { $set: { isActive: false } },
    { new: true, runValidators: true }
  );

  if (!channel) {
    throw new NotFoundError("Channel not found");
  }

  return channel;
};
