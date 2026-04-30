import mongoose from "mongoose";

const icalSourceSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property"
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room"
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel"
    },

    sourceName: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    icalUrl: {
      type: String,
      trim: true
    },
    roomCount: {
      type: Number,
      min: 1
    },

    lastSyncedAt: Date,

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("IcalSource", icalSourceSchema);
