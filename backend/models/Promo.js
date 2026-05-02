import mongoose from "mongoose";

const promoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      unique: true
    },
    description: {
      type: String,
      trim: true
    },
    adjustmentType: {
      type: String,
      enum: ["none", "percentage_discount", "fixed_discount", "surcharge"],
      default: "none"
    },
    adjustmentValue: {
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

export default mongoose.model("Promo", promoSchema);
