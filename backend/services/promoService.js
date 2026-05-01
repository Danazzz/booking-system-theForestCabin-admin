import mongoose from "mongoose";
import Promo from "../models/Promo.js";
import { ConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";

const promoFields = [
  "name",
  "description",
  "isActive"
];

const updateFields = [
  "name",
  "description",
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

const handleDuplicatePromo = (error) => {
  if (error.code === 11000) {
    throw new ConflictError("Promo already exists", error.keyValue);
  }

  throw error;
};

export const createPromo = async (payload) => {
  const data = pickFields(payload, promoFields);

  if (!data.name) {
    throw new ValidationError("name is required");
  }

  try {
    return await Promo.create(data);
  } catch (error) {
    handleDuplicatePromo(error);
  }
};

export const listPromos = async (filters = {}) => {
  const query = {};

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true" || filters.isActive === true;
  }

  return Promo.find(query).sort({ isActive: -1, name: 1, createdAt: -1 });
};

export const getPromoById = async (promoId) => {
  validateObjectId(promoId, "promoId");

  const promo = await Promo.findById(promoId);

  if (!promo) {
    throw new NotFoundError("Promo not found");
  }

  return promo;
};

export const ensureActivePromo = async (promoId) => {
  if (!promoId) {
    return null;
  }

  validateObjectId(promoId, "promoId");

  const promo = await Promo.findOne({
    _id: promoId,
    isActive: true
  });

  if (!promo) {
    throw new ValidationError("Selected promo is not available");
  }

  return promo;
};

export const updatePromo = async (promoId, payload) => {
  validateObjectId(promoId, "promoId");

  const updates = pickFields(payload, updateFields);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one promo field is required");
  }

  try {
    const promo = await Promo.findByIdAndUpdate(
      promoId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!promo) {
      throw new NotFoundError("Promo not found");
    }

    return promo;
  } catch (error) {
    handleDuplicatePromo(error);
  }
};

export const deletePromo = async (promoId) => {
  validateObjectId(promoId, "promoId");

  const promo = await Promo.findByIdAndUpdate(
    promoId,
    { $set: { isActive: false } },
    { new: true, runValidators: true }
  );

  if (!promo) {
    throw new NotFoundError("Promo not found");
  }

  return promo;
};
