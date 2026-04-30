import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

channelSchema.index({ propertyId: 1, name: 1 }, { unique: true });

export default mongoose.model("Channel", channelSchema);
