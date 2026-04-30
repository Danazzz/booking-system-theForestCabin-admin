import mongoose from "mongoose";

const channelIntegrationSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },
    channelName: {
      type: String,
      enum: ["Traveloka", "Agoda", "GoogleCalendar", "Other"],
      required: true
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },
    icalUrl: String,
    apiKeyRef: String,
    lastSyncedAt: Date
  },
  { timestamps: true }
);

channelIntegrationSchema.index({ propertyId: 1, channelName: 1 });

export default mongoose.model("ChannelIntegration", channelIntegrationSchema);
