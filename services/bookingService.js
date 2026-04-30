import Booking from "../models/Booking.js";
import { ensureAvailability, parseStayDates } from "./availabilityService.js";
import { ValidationError } from "./bookingErrors.js";
import {
  createEvent,
  updateEvent,
  deleteEvent
} from "./googleCalendarService.js";

const sourceTypeBySource = {
  Traveloka: "ota",
  Agoda: "ota",
  Manual: "manual",
  GoogleCalendar: "calendar",
  Other: "direct"
};

const normalizeSource = (source = "Manual") => {
  if (["Traveloka", "Agoda", "Manual", "GoogleCalendar", "Other"].includes(source)) {
    return source;
  }

  return "Other";
};

export const createBooking = async (payload) => {
  const { checkIn, checkOut } = parseStayDates(payload);
  const source = normalizeSource(payload.source || payload.sourceName);
  const roomCount = Number(payload.roomCount || 1);

  await ensureAvailability({
    propertyId: payload.propertyId,
    roomId: payload.roomId,
    checkIn,
    checkOut,
    roomCount
  });

  return Booking.create({
    propertyId: payload.propertyId,
    roomId: payload.roomId,
    source,
    sourceType: sourceTypeBySource[source],
    sourceName: payload.sourceName || source,
    externalId: payload.externalId,
    guestName: payload.guestName,
    guestCount: payload.guestCount,
    roomCount,
    checkIn,
    checkOut,
    price: payload.price,
    promoCode: payload.promoCode,
    status: "confirmed",
    rawPayload: payload.rawPayload
  });
};

export const updateExistingBooking = async (booking, payload) => {
  const { checkIn, checkOut } = parseStayDates({
    checkIn: payload.checkIn ?? booking.checkIn,
    checkOut: payload.checkOut ?? booking.checkOut
  });
  const roomCount = Number(payload.roomCount ?? booking.roomCount);

  await ensureAvailability({
    propertyId: booking.propertyId,
    roomId: payload.roomId || booking.roomId,
    checkIn,
    checkOut,
    roomCount,
    excludeBookingId: booking._id
  });

  booking.roomId = payload.roomId || booking.roomId;
  booking.guestName = payload.guestName ?? booking.guestName;
  booking.guestCount = payload.guestCount ?? booking.guestCount;
  booking.roomCount = roomCount;
  booking.checkIn = checkIn;
  booking.checkOut = checkOut;
  booking.status = "confirmed";
  booking.rawPayload = payload.rawPayload ?? booking.rawPayload;

  return booking.save();
};

export const listBookings = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) query.propertyId = filters.propertyId;
  if (filters.roomId) query.roomId = filters.roomId;
  if (filters.source) query.source = filters.source;
  if (filters.status) query.status = filters.status;

  return Booking.find(query)
    .populate("propertyId", "name timezone")
    .populate("roomId", "name code totalUnits")
    .sort({ checkIn: 1, createdAt: 1 });
};

export const syncExternalBookings = async ({
  propertyId,
  source,
  bookings = []
}) => {
  if (!Array.isArray(bookings)) {
    throw new ValidationError("bookings must be an array");
  }

  const result = {
    inserted: 0,
    updated: 0,
    rejected: 0,
    errors: []
  };

  for (const incoming of bookings) {
    try {
      const normalizedSource = normalizeSource(source || incoming.source);
      const existing = incoming.externalId
        ? await Booking.findOne({
            propertyId,
            source: normalizedSource,
            externalId: incoming.externalId
          })
        : null;

      if (existing) {
        await updateExistingBooking(existing, {
          ...incoming,
          propertyId,
          source: normalizedSource
        });
        result.updated++;
        continue;
      }

      await createBooking({
        ...incoming,
        propertyId,
        source: normalizedSource
      });
      result.inserted++;
    } catch (error) {
      result.rejected++;
      result.errors.push({
        externalId: incoming.externalId,
        message: error.message,
        details: error.details
      });
    }
  }

  return result;
};

const hasRoomAvailabilityConflict = async ({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  roomCount = 1,
  excludeBookingId = null
}) => {
  try {
    await ensureAvailability({
      propertyId,
      roomId,
      checkIn,
      checkOut,
      roomCount,
      excludeBookingId
    });

    return false;
  } catch (error) {
    return error.name === "BookingConflictError";
  }
};

const findDefaultRoomId = async (propertyId) => {
  const booking = await Booking.findOne({ propertyId }).sort({ createdAt: 1 });

  if (!booking?.roomId) {
    throw new ValidationError("roomId is required for iCal sync until a default room is configured");
  }

  return booking.roomId;
};

const isConflict = async ({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  excludeBookingId = null
}) => {
  if (roomId) {
    return hasRoomAvailabilityConflict({
      propertyId,
      roomId,
      checkIn,
      checkOut,
      excludeBookingId
    });
  }

  const conflict = await Booking.findOne({
    propertyId,
    status: "confirmed",
    _id: { $ne: excludeBookingId },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn }
  });

  return !!conflict;
};

export const syncBookings = async ({
  events,
  propertyId,
  sourceName,
  roomId
}) => {
  let inserted = 0;
  let updated = 0;
  let cancelled = 0;
  let conflicts = 0; // 🔥 tambahan

  const existingBookings = await Booking.find({
    propertyId,
    sourceName,
    sourceType: "ota"
  });

  const syncRoomId = roomId || await findDefaultRoomId(propertyId);

  const eventMap = new Map();

  for (const event of events) {
    eventMap.set(event.uid, event);
  }

  // =========================
  // 1. INSERT + UPDATE
  // =========================
  for (const event of events) {
    const existing = existingBookings.find(
      b => b.externalId === event.uid
    );

    // =====================
    // 🔹 INSERT
    // =====================
    if (!existing) {
      const conflict = await isConflict({
        propertyId,
        roomId: syncRoomId,
        checkIn: event.start,
        checkOut: event.end
      });

      if (conflict) {
        console.warn("Conflict detected (INSERT):", event.uid);
        conflicts++;
        continue; // ❗ skip booking
      }

      const newBooking = new Booking({
        propertyId,
        roomId: syncRoomId,
        source: normalizeSource(sourceName),
        sourceType: "ota",
        sourceName,
        externalId: event.uid,
        guestName: event.summary,
        roomCount: 1,
        checkIn: event.start,
        checkOut: event.end,
        status: "confirmed",
        rawPayload: event
      });

      // 🔥 GOOGLE CREATE
      try {
        const eventId = await createEvent(newBooking);
        newBooking.googleCalendarEventId = eventId;
      } catch (err) {
        console.error("Google create event error:", err.message);
      }

      await newBooking.save();
      inserted++;
    }

    // =====================
    // 🔹 UPDATE
    // =====================
    else {
      const changed =
        existing.checkIn.getTime() !== new Date(event.start).getTime() ||
        existing.checkOut.getTime() !== new Date(event.end).getTime() ||
        existing.guestName !== event.summary;

      if (changed) {
        const conflict = await isConflict({
          propertyId,
          roomId: existing.roomId || syncRoomId,
          checkIn: event.start,
          checkOut: event.end,
          excludeBookingId: existing._id
        });

        if (conflict) {
          console.warn("Conflict detected (UPDATE):", event.uid);
          conflicts++;
          continue;
        }

        existing.checkIn = event.start;
        existing.checkOut = event.end;
        existing.guestName = event.summary;
        existing.status = "confirmed";
        existing.rawPayload = event;

        // 🔥 GOOGLE UPDATE
        try {
          if (existing.googleCalendarEventId) {
            await updateEvent(
              existing.googleCalendarEventId,
              existing
            );
          }
        } catch (err) {
          console.error("Google update event error:", err.message);
        }

        await existing.save();
        updated++;
      }
    }
  }

  // =========================
  // 2. HANDLE CANCEL
  // =========================
  for (const booking of existingBookings) {
    if (!eventMap.has(booking.externalId)) {
      if (booking.status !== "cancelled") {
        booking.status = "cancelled";

        // 🔥 GOOGLE DELETE
        try {
          if (booking.googleCalendarEventId) {
            await deleteEvent(booking.googleCalendarEventId);
          }
        } catch (err) {
          console.error("Google delete event error:", err.message);
        }

        await booking.save();
        cancelled++;
      }
    }
  }

  return { inserted, updated, cancelled, conflicts };
};
