import mongoose from "mongoose";

const channelIntegrationSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property"
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel"
    },
    channelName: {
      type: String,
      trim: true,
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
