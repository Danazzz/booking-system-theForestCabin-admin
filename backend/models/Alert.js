import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      index: true
    },
    type: {
      type: String,
      enum: ["LOW_AVAILABILITY", "OVERBOOKING_ATTEMPT", "SYNC_DELAY"],
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

alertSchema.index({ propertyId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Alert", alertSchema);
