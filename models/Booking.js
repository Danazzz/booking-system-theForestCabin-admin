import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true
    },
    source: {
      type: String,
      enum: ["Traveloka", "Agoda", "Manual", "GoogleCalendar", "Other"],
      required: true
    },
    sourceType: {
      type: String,
      enum: ["ota", "manual", "calendar", "direct"],
      default: "manual"
    },
    sourceName: String,
    externalId: {
      type: String,
      trim: true
    },
    guestName: {
      type: String,
      trim: true
    },
    guestCount: {
      type: Number,
      default: 1
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
    promoCode: String,
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

export default mongoose.model("Booking", bookingSchema);
