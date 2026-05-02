import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Channel from "../models/Channel.js";
import Room from "../models/Room.js";
import { ensureActivePromo } from "./promoService.js";
import { ensureAvailability, parseStayDates } from "./availabilityService.js";
import { createOverbookingAttemptAlert } from "./alertService.js";
import { ConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";
import { notifyBookingSuccessful } from "./notificationService.js";
import {
  createEvent,
  updateEvent,
  deleteEvent
} from "./googleCalendarService.js";

const parseRoomCount = (roomCount) => {
  if (roomCount === undefined || roomCount === null || roomCount === "") {
    throw new ValidationError("roomCount is required");
  }

  const parsedRoomCount = Number(roomCount);

  if (!Number.isInteger(parsedRoomCount) || parsedRoomCount < 1) {
    throw new ValidationError("roomCount must be a positive integer");
  }

  return parsedRoomCount;
};

const bookingUpdateFields = [
  "roomId",
  "roomIds",
  "channelId",
  "sourceName",
  "source",
  "externalId",
  "guestName",
  "guestCount",
  "roomCount",
  "checkIn",
  "checkOut",
  "price",
  "promoId",
  "promo",
  "promoCode",
  "notes",
  "rawPayload"
];

const validateObjectId = (id, fieldName = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} must be a valid MongoDB ObjectId`);
  }
};

const pickFields = (payload, fields) => {
  const data = {};

  for (const field of fields) {
    if (payload[field] !== undefined) {
      data[field] = payload[field];
    }
  }

  return data;
};

const handleDuplicateBooking = (error) => {
  if (error.code === 11000) {
    throw new ConflictError("Booking already exists for this source and externalId", error.keyValue);
  }

  throw error;
};

const validateNotes = (notes) => {
  if (notes !== undefined && notes !== null && String(notes).length > 500) {
    throw new ValidationError("notes must be 500 characters or fewer");
  }
};

const resolvePromo = async (promoId) => {
  if (promoId === undefined) {
    return undefined;
  }

  if (promoId === null || promoId === "") {
    return null;
  }

  const promo = await ensureActivePromo(promoId);

  return promo;
};

const populateBooking = (booking) => {
  return Booking.findById(booking._id)
    .populate("roomId", "name code totalUnits basePrice")
    .populate("roomIds", "name code totalUnits basePrice")
    .populate("channelId", "name type isActive")
    .populate("promoId", "name description adjustmentType adjustmentValue isActive");
};

const normalizeRoomIds = (payload) => {
  const ids = Array.isArray(payload.roomIds) && payload.roomIds.length > 0
    ? payload.roomIds
    : [payload.roomId].filter(Boolean);

  if (ids.length === 0) {
    throw new ValidationError("At least one room must be selected");
  }

  const uniqueIds = [...new Set(ids.map((id) => String(id)))];

  for (const id of uniqueIds) {
    validateObjectId(id, "roomId");
  }

  return uniqueIds;
};

const resolveRooms = async ({ propertyId, roomIds }) => {
  const query = {
    _id: { $in: roomIds },
    isActive: true
  };

  if (propertyId) {
    query.propertyId = propertyId;
  }

  const rooms = await Room.find(query);

  if (rooms.length !== roomIds.length) {
    throw new ValidationError("One or more selected rooms are not available");
  }

  return rooms;
};

const calculateRoomPrice = (rooms) => {
  return rooms.reduce((sum, room) => sum + Number(room.basePrice || 0), 0);
};

const applyPromoPricing = (basePrice, promo) => {
  if (!promo || promo.adjustmentType === "none") {
    return basePrice;
  }

  const adjustmentValue = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return Math.max(0, basePrice - (basePrice * adjustmentValue / 100));
  }

  if (promo.adjustmentType === "fixed_discount") {
    return Math.max(0, basePrice - adjustmentValue);
  }

  if (promo.adjustmentType === "surcharge") {
    return basePrice + adjustmentValue;
  }

  return basePrice;
};

const resolveChannel = async ({
  propertyId,
  channelId,
  sourceName,
  source
}) => {
  const query = {
    isActive: true
  };

  if (propertyId) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      throw new ValidationError("propertyId must be a valid MongoDB ObjectId");
    }

    query.propertyId = propertyId;
  }

  if (channelId) {
    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ValidationError("channelId must be a valid MongoDB ObjectId");
    }

    query._id = channelId;
  } else {
    const channelName = sourceName || source;

    if (!channelName) {
      throw new ValidationError("channelId or sourceName is required");
    }

    query.name = channelName;
  }

  const channel = await Channel.findOne(query);

  if (!channel) {
    throw new ValidationError("Active booking channel is not configured");
  }

  return channel;
};

const getBookingChannelFields = (channel) => ({
  channelId: channel._id,
  source: channel.name,
  sourceType: channel.type,
  sourceName: channel.name
});

const applyChannelToBooking = (booking, channel) => {
  booking.channelId = channel._id;
  booking.source = channel.name;
  booking.sourceType = channel.type;
  booking.sourceName = channel.name;
};

const sourceIdentityQuery = (channel) => ({
  $or: [
    { channelId: channel._id },
    { sourceName: channel.name },
    { source: channel.name }
  ]
});

const ensureBookingAvailability = async ({
  propertyId,
  roomId,
  roomIds,
  checkIn,
  checkOut,
  roomCount,
  excludeBookingId = null,
  channel,
  rawPayload
}) => {
  try {
    return await ensureAvailability({
      propertyId,
      roomId,
      roomIds,
      checkIn,
      checkOut,
      roomCount,
      excludeBookingId
    });
  } catch (error) {
    if (error.name === "BookingConflictError") {
      await createOverbookingAttemptAlert({
        propertyId,
        roomId: error.details?.roomId || roomId,
        channel,
        checkIn,
        checkOut,
        roomCount,
        conflictDetails: error.details,
        rawPayload
      });
    }

    throw error;
  }
};

const addGoogleCalendarEvent = async (booking) => {
  try {
    const eventId = await createEvent(booking);
    booking.googleCalendarEventId = eventId;
    await booking.save();
  } catch (error) {
    console.error("Google create event error:", error.message);
  }
};

export const createBooking = async (payload) => {
  const { checkIn, checkOut } = parseStayDates(payload);
  validateNotes(payload.notes);
  const roomIds = normalizeRoomIds(payload);
  const rooms = await resolveRooms({
    propertyId: payload.propertyId,
    roomIds
  });
  const channel = await resolveChannel({
    propertyId: payload.propertyId,
    channelId: payload.channelId,
    sourceName: payload.sourceName,
    source: payload.source
  });
  const roomCount = roomIds.length;
  const promo = await resolvePromo(payload.promoId);
  const basePrice = calculateRoomPrice(rooms);
  const promoPrice = applyPromoPricing(basePrice, promo);

  await ensureBookingAvailability({
    propertyId: payload.propertyId,
    roomId: roomIds[0],
    roomIds,
    checkIn,
    checkOut,
    roomCount,
    channel,
    rawPayload: payload
  });

  try {
    const booking = await Booking.create({
      propertyId: payload.propertyId,
      roomId: roomIds[0],
      roomIds,
      ...getBookingChannelFields(channel),
      externalId: payload.externalId,
      guestName: payload.guestName,
      guestCount: payload.guestCount,
      roomCount,
      checkIn,
      checkOut,
      price: promo ? promoPrice : payload.price ?? basePrice,
      promoId: promo?._id || null,
      promo: payload.promo,
      promoCode: payload.promoCode,
      notes: payload.notes,
      status: "confirmed",
      rawPayload: payload.rawPayload
    });

    const populatedBooking = await populateBooking(booking);
    await addGoogleCalendarEvent(populatedBooking);
    const savedBooking = await populateBooking(populatedBooking);
    await notifyBookingSuccessful(savedBooking);

    return savedBooking;
  } catch (error) {
    handleDuplicateBooking(error);
  }
};

export const updateExistingBooking = async (booking, payload) => {
  validateNotes(payload.notes);
  const { checkIn, checkOut } = parseStayDates({
    checkIn: payload.checkIn ?? booking.checkIn,
    checkOut: payload.checkOut ?? booking.checkOut
  });
  const roomIds = normalizeRoomIds({
    roomIds: payload.roomIds ?? booking.roomIds,
    roomId: payload.roomId ?? booking.roomId
  });
  const rooms = await resolveRooms({
    propertyId: booking.propertyId,
    roomIds
  });
  const roomCount = roomIds.length;
  const promo = payload.promoId === undefined && booking.promoId
    ? await ensureActivePromo(booking.promoId)
    : await resolvePromo(payload.promoId);
  const basePrice = calculateRoomPrice(rooms);
  const promoPrice = applyPromoPricing(basePrice, promo);
  const hasChannelInput = payload.channelId || payload.sourceName || payload.source;
  const channel = await resolveChannel({
    propertyId: booking.propertyId,
    channelId: payload.channelId || (!hasChannelInput ? booking.channelId : undefined),
    sourceName: payload.sourceName || (!hasChannelInput ? booking.sourceName : undefined),
    source: payload.source || (!hasChannelInput ? booking.source : undefined)
  });

  await ensureBookingAvailability({
    propertyId: booking.propertyId,
    roomId: roomIds[0],
    roomIds,
    checkIn,
    checkOut,
    roomCount,
    excludeBookingId: booking._id,
    channel,
    rawPayload: payload
  });

  booking.roomId = roomIds[0];
  booking.roomIds = roomIds;
  applyChannelToBooking(booking, channel);
  booking.guestName = payload.guestName ?? booking.guestName;
  booking.guestCount = payload.guestCount ?? booking.guestCount;
  booking.externalId = payload.externalId ?? booking.externalId;
  booking.roomCount = roomCount;
  booking.checkIn = checkIn;
  booking.checkOut = checkOut;
  booking.price = promo ? promoPrice : payload.price ?? basePrice;
  if (promo !== undefined) {
    booking.promoId = promo?._id || null;
  }
  booking.promo = payload.promo ?? booking.promo;
  booking.promoCode = payload.promoCode ?? booking.promoCode;
  booking.notes = payload.notes ?? booking.notes;
  booking.status = "confirmed";
  booking.rawPayload = payload.rawPayload ?? booking.rawPayload;

  try {
    const savedBooking = await booking.save();
    const populatedBooking = await populateBooking(savedBooking);

    try {
      if (populatedBooking.googleCalendarEventId) {
        await updateEvent(populatedBooking.googleCalendarEventId, populatedBooking);
      } else {
        await addGoogleCalendarEvent(populatedBooking);
      }
    } catch (error) {
      console.error("Google update event error:", error.message);
    }

    return populateBooking(populatedBooking);
  } catch (error) {
    handleDuplicateBooking(error);
  }
};

export const listBookings = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) query.propertyId = filters.propertyId;
  if (filters.roomId) {
    query.$or = [
      { roomId: filters.roomId },
      { roomIds: filters.roomId }
    ];
  }
  if (filters.channelId) query.channelId = filters.channelId;
  if (filters.promoId) query.promoId = filters.promoId;
  if (filters.source) query.source = filters.source;
  if (filters.status) query.status = filters.status;

  return Booking.find(query)
    .populate("roomId", "name code totalUnits basePrice")
    .populate("roomIds", "name code totalUnits basePrice")
    .populate("channelId", "name type isActive")
    .populate("promoId", "name description adjustmentType adjustmentValue isActive")
    .sort({ checkIn: 1, createdAt: 1 });
};

export const getBookingById = async (bookingId) => {
  validateObjectId(bookingId, "bookingId");

  const booking = await Booking.findById(bookingId)
    .populate("roomId", "name code totalUnits basePrice")
    .populate("roomIds", "name code totalUnits basePrice")
    .populate("channelId", "name type isActive")
    .populate("promoId", "name description adjustmentType adjustmentValue isActive");

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return booking;
};

export const updateBooking = async (bookingId, payload) => {
  validateObjectId(bookingId, "bookingId");

  const updates = pickFields(payload, bookingUpdateFields);

  if (Object.keys(updates).length === 0) {
    throw new ValidationError("At least one booking field is required");
  }

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  return updateExistingBooking(booking, updates);
};

export const deleteBooking = async (bookingId) => {
  validateObjectId(bookingId, "bookingId");

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new NotFoundError("Booking not found");
  }

  booking.status = "cancelled";

  try {
    if (booking.googleCalendarEventId) {
      await deleteEvent(booking.googleCalendarEventId);
      booking.googleCalendarEventId = undefined;
    }
  } catch (error) {
    console.error("Google delete event error:", error.message);
  }

  return booking.save();
};

export const syncExternalBookings = async ({
  propertyId,
  channelId,
  sourceName,
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
      const channel = await resolveChannel({
        propertyId,
        channelId: incoming.channelId || channelId,
        sourceName: incoming.sourceName || incoming.source || sourceName || source
      });
      const existing = incoming.externalId
        ? await Booking.findOne({
            ...(propertyId ? { propertyId } : {}),
            externalId: incoming.externalId,
            ...sourceIdentityQuery(channel)
          })
        : null;

      if (existing) {
        await updateExistingBooking(existing, {
          ...incoming,
          propertyId,
          channelId: channel._id,
          sourceName: channel.name,
          source: channel.name
        });
        result.updated++;
        continue;
      }

      await createBooking({
        ...incoming,
        propertyId,
        channelId: channel._id,
        sourceName: channel.name,
        source: channel.name
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
  roomCount,
  excludeBookingId = null,
  channel,
  rawPayload
}) => {
  try {
    await ensureBookingAvailability({
      propertyId,
      roomId,
      checkIn,
      checkOut,
      roomCount,
      excludeBookingId,
      channel,
      rawPayload
    });

    return false;
  } catch (error) {
    if (error.name === "BookingConflictError") {
      return true;
    }

    throw error;
  }
};

const isConflict = async ({
  propertyId,
  roomId,
  checkIn,
  checkOut,
  roomCount,
  excludeBookingId = null,
  channel,
  rawPayload
}) => {
  if (!roomId) {
    throw new ValidationError("roomId is required for sync");
  }

  return hasRoomAvailabilityConflict({
    propertyId,
    roomId,
    checkIn,
    checkOut,
    roomCount,
    excludeBookingId,
    channel,
    rawPayload
  });
};

export const syncBookings = async ({
  events,
  propertyId,
  channelId,
  sourceName,
  roomId,
  roomCount
}) => {
  if (!Array.isArray(events)) {
    throw new ValidationError("events must be an array");
  }

  if (!roomId) {
    throw new ValidationError("roomId is required for sync");
  }

  const channel = await resolveChannel({
    propertyId,
    channelId,
    sourceName
  });
  const configuredRoomCount = roomCount === undefined || roomCount === null || roomCount === ""
    ? null
    : parseRoomCount(roomCount);

  let inserted = 0;
  let updated = 0;
  let cancelled = 0;
  let conflicts = 0;

  const existingBookings = await Booking.find({
    ...(propertyId ? { propertyId } : {}),
    ...sourceIdentityQuery(channel)
  });

  const eventMap = new Map();

  for (const event of events) {
    eventMap.set(event.uid, event);
  }

  for (const event of events) {
    const existing = existingBookings.find(
      b => b.externalId === event.uid
    );
    const { checkIn, checkOut } = parseStayDates({
      checkIn: event.start,
      checkOut: event.end
    });
    const eventRoomCount = parseRoomCount(event.roomCount ?? configuredRoomCount);

    if (!existing) {
      const conflict = await isConflict({
        propertyId,
        roomId,
        checkIn,
        checkOut,
        roomCount: eventRoomCount,
        channel,
        rawPayload: {
          ...event,
          externalId: event.uid
        }
      });

      if (conflict) {
        console.warn("Conflict detected (INSERT):", event.uid);
        conflicts++;
        continue;
      }

      const newBooking = new Booking({
        propertyId,
        roomId,
        roomIds: [roomId],
        ...getBookingChannelFields(channel),
        externalId: event.uid,
        guestName: event.summary,
        roomCount: eventRoomCount,
        checkIn,
        checkOut,
        status: "confirmed",
        rawPayload: event
      });

      await newBooking.save();
      await addGoogleCalendarEvent(newBooking);
      await notifyBookingSuccessful(newBooking);
      inserted++;
    }

    else {
      const changed =
        existing.checkIn.getTime() !== checkIn.getTime() ||
        existing.checkOut.getTime() !== checkOut.getTime() ||
        existing.guestName !== event.summary ||
        existing.roomCount !== eventRoomCount ||
        String(existing.roomId) !== String(roomId) ||
        String(existing.channelId || "") !== String(channel._id);

      if (changed) {
        const conflict = await isConflict({
          propertyId,
          roomId,
          checkIn,
          checkOut,
          roomCount: eventRoomCount,
          excludeBookingId: existing._id,
          channel,
          rawPayload: {
            ...event,
            externalId: event.uid
          }
        });

        if (conflict) {
          console.warn("Conflict detected (UPDATE):", event.uid);
          conflicts++;
          continue;
        }

        existing.roomId = roomId;
        existing.roomIds = [roomId];
        applyChannelToBooking(existing, channel);
        existing.checkIn = checkIn;
        existing.checkOut = checkOut;
        existing.guestName = event.summary;
        existing.roomCount = eventRoomCount;
        existing.status = "confirmed";
        existing.rawPayload = event;

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

  for (const booking of existingBookings) {
    if (!eventMap.has(booking.externalId)) {
      if (booking.status !== "cancelled") {
        booking.status = "cancelled";

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
