import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true
    },
    totalUnits: {
      type: Number,
      required: true,
      min: 1
    },
    maxGuestsPerUnit: {
      type: Number,
      min: 1
    },
    basePrice: {
      type: Number,
      min: 0,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

roomSchema.index({ propertyId: 1, code: 1 }, { unique: true });

export default mongoose.model("Room", roomSchema);
