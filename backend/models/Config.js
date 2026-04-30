import mongoose from "mongoose";

const configSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      unique: true,
      index: true
    },
    lowAvailabilityThreshold: {
      type: Number,
      required: true,
      min: 0
    },
    syncDelayThresholdMinutes: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { timestamps: true }
);

export default mongoose.model("Config", configSchema);
