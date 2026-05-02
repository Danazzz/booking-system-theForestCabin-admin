import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property"
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true
    },
    roomIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      index: true
    }],
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      index: true
    },
    source: {
      type: String,
      trim: true,
      required: true
    },
    sourceType: {
      type: String,
      trim: true,
      uppercase: true
    },
    sourceName: {
      type: String,
      trim: true
    },
    externalId: {
      type: String,
      trim: true
    },
    guestName: {
      type: String,
      trim: true
    },
    guestCount: {
      type: Number
    },
    roomCount: {
      type: Number,
      required: true,
      min: 1
    },
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    },
    price: Number,
    promoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promo",
      index: true
    },
    promo: {
      type: String,
      trim: true
    },
    promoCode: String,
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "rejected"],
      default: "confirmed"
    },
    googleCalendarEventId: String,
    rawPayload: Object
  },
  { timestamps: true }
);

bookingSchema.index({
  propertyId: 1,
  roomId: 1,
  status: 1,
  checkIn: 1,
  checkOut: 1
});
bookingSchema.index(
  { propertyId: 1, source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);
bookingSchema.index(
  { propertyId: 1, channelId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export default mongoose.model("Booking", bookingSchema);
