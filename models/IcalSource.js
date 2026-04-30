import mongoose from "mongoose";

const icalSourceSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room"
    },

    sourceName: String,
    icalUrl: String,

    lastSyncedAt: Date,

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("IcalSource", icalSourceSchema);
