import Config from "../models/Config.js";
import mongoose from "mongoose";
import { ConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";

const configFields = [
  "lowAvailabilityThreshold",
  "syncDelayThresholdMinutes"
];

const validateObjectId = (id, fieldName = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} must be a valid MongoDB ObjectId`);
  }
};

const pickConfigFields = (payload) => {
  const data = {};

  for (const field of configFields) {
    if (payload[field] !== undefined) {
      data[field] = payload[field];
    }
  }

  return data;
};

const handleDuplicateConfig = (error) => {
  if (error.code === 11000) {
    throw new ConflictError("Config already exists for this property", error.keyValue);
  }

  throw error;
};

export const createConfig = async ({ propertyId, ...payload }) => {
  if (propertyId) {
    validateObjectId(propertyId, "propertyId");
  }

  const configData = pickConfigFields(payload);

  for (const field of configFields) {
    if (configData[field] === undefined) {
      throw new ValidationError(`${field} is required`);
    }
  }

  try {
    return await Config.create({
      ...(propertyId ? { propertyId } : {}),
      ...configData
    });
  } catch (error) {
    handleDuplicateConfig(error);
  }
};

export const listConfigs = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) {
    validateObjectId(filters.propertyId, "propertyId");
    query.propertyId = filters.propertyId;
  }

  return Config.find(query)
    .populate("propertyId", "name timezone")
    .sort({ createdAt: -1 });
};

export const getConfig = async (propertyId) => {
  if (propertyId) {
    validateObjectId(propertyId, "propertyId");
  }

  const config = await Config.findOne(propertyId ? { propertyId } : {});

  if (!config) {
    throw new NotFoundError("Config not found for this property");
  }

  return config;
};

export const getConfigById = async (configId) => {
  validateObjectId(configId, "configId");

  const config = await Config.findById(configId).populate("propertyId", "name timezone");

  if (!config) {
    throw new NotFoundError("Config not found");
  }

  return config;
};

export const updateConfig = async ({ propertyId, ...updates }) => {
  if (propertyId) {
    validateObjectId(propertyId, "propertyId");
  }

  const allowedUpdates = pickConfigFields(updates);

  if (Object.keys(allowedUpdates).length === 0) {
    throw new ValidationError("At least one config field is required");
  }

  const query = propertyId ? { propertyId } : {};
  const existingConfig = await Config.findOne(query);

  if (!existingConfig) {
    for (const field of configFields) {
      if (allowedUpdates[field] === undefined) {
        throw new ValidationError(`${field} is required when creating config`);
      }
    }
  }

  try {
    return await Config.findOneAndUpdate(
      query,
      { $set: allowedUpdates },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: false
      }
    );
  } catch (error) {
    handleDuplicateConfig(error);
  }
};

export const updateConfigById = async (configId, payload) => {
  validateObjectId(configId, "configId");

  const updates = pickConfigFields(payload);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one config field is required");
  }

  const config = await Config.findByIdAndUpdate(
    configId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!config) {
    throw new NotFoundError("Config not found");
  }

  return config;
};

export const deleteConfig = async (configId) => {
  validateObjectId(configId, "configId");

  const config = await Config.findByIdAndDelete(configId);

  if (!config) {
    throw new NotFoundError("Config not found");
  }

  return config;
};
