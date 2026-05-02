import ical from "node-ical";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Channel from "../models/Channel.js";
import Config from "../models/Config.js";
import IcalSource from "../models/IcalSource.js";
import Room from "../models/Room.js";
import { createSyncDelayAlert } from "./alertService.js";
import { createBooking } from "./bookingService.js";
import { BookingConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";
import { parseStayDates } from "./availabilityService.js";

const icalSourceFields = [
  "propertyId",
  "url",
  "icalUrl",
  "roomId",
  "channelId",
  "sourceName",
  "roomCount",
  "isActive"
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

const validateIcalUrl = (url) => {
  if (!url) {
    throw new ValidationError("iCal source url is required");
  }

  const value = String(url).trim().toLowerCase();

  if (!/^https?:\/\//.test(value) || !value.includes(".ics")) {
    throw new ValidationError("iCal URL must start with http:// or https:// and contain .ics");
  }
};

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

export const fetchIcalData = async (url) => {
  if (!url) {
    throw new ValidationError("iCal source url is required");
  }

  return ical.async.fromURL(url);
};

export const parseEvents = (data) => {
  return Object.values(data || {}).filter((event) => event?.type === "VEVENT");
};

const getSourceUrl = (icalSource) => {
  return icalSource.url || icalSource.icalUrl;
};

const getEventExternalId = (event) => {
  return event.uid || event.id;
};

const resolveRoom = async ({ roomId, propertyId }) => {
  if (!roomId) {
    throw new ValidationError("roomId is required");
  }

  validateObjectId(roomId, "roomId");

  const query = {
    _id: roomId,
    isActive: true
  };

  if (propertyId) {
    validateObjectId(propertyId, "propertyId");
    query.propertyId = propertyId;
  }

  const room = await Room.findOne(query);

  if (!room) {
    throw new ValidationError("Active room is not configured");
  }

  return room;
};

const resolveChannel = async ({ channelId, sourceName, propertyId }) => {
  const query = {
    isActive: true
  };

  if (propertyId) {
    validateObjectId(propertyId, "propertyId");
    query.propertyId = propertyId;
  }

  if (channelId) {
    validateObjectId(channelId, "channelId");
    query._id = channelId;
  } else if (sourceName) {
    query.name = sourceName;
  } else {
    throw new ValidationError("channelId or sourceName is required");
  }

  const channel = await Channel.findOne(query);

  if (!channel) {
    throw new ValidationError("Active booking channel is not configured");
  }

  return channel;
};

const buildIcalSourceData = async (payload) => {
  const data = pickFields(payload, icalSourceFields);
  const url = data.url || data.icalUrl;

  validateIcalUrl(url);
  await resolveRoom({
    roomId: data.roomId,
    propertyId: data.propertyId
  });

  const channel = await resolveChannel({
    channelId: data.channelId,
    sourceName: data.sourceName,
    propertyId: data.propertyId
  });

  return {
    ...data,
    url,
    icalUrl: data.icalUrl || url,
    channelId: channel._id,
    sourceName: channel.name,
    roomCount: parseRoomCount(data.roomCount)
  };
};

export const createIcalSource = async (payload) => {
  const data = await buildIcalSourceData(payload);

  return IcalSource.create(data);
};

export const listIcalSources = async (filters = {}) => {
  const query = {};

  if (filters.propertyId) {
    validateObjectId(filters.propertyId, "propertyId");
    query.propertyId = filters.propertyId;
  }

  if (filters.roomId) {
    validateObjectId(filters.roomId, "roomId");
    query.roomId = filters.roomId;
  }

  if (filters.channelId) {
    validateObjectId(filters.channelId, "channelId");
    query.channelId = filters.channelId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true" || filters.isActive === true;
  }

  return IcalSource.find(query)
    .populate("roomId", "name code totalUnits")
    .populate("channelId", "name type isActive")
    .sort({ isActive: -1, sourceName: 1, createdAt: -1 });
};

export const getIcalSourceById = async (sourceId) => {
  validateObjectId(sourceId, "icalSourceId");

  const source = await IcalSource.findById(sourceId)
    .populate("roomId", "name code totalUnits")
    .populate("channelId", "name type isActive");

  if (!source) {
    throw new NotFoundError("iCal source not found");
  }

  return source;
};

export const updateIcalSource = async (sourceId, payload) => {
  validateObjectId(sourceId, "icalSourceId");

  const existing = await IcalSource.findById(sourceId);

  if (!existing) {
    throw new NotFoundError("iCal source not found");
  }

  const merged = {
    propertyId: existing.propertyId,
    url: existing.url,
    icalUrl: existing.icalUrl,
    roomId: existing.roomId,
    channelId: existing.channelId,
    sourceName: existing.sourceName,
    roomCount: existing.roomCount,
    isActive: existing.isActive,
    ...pickFields(payload, icalSourceFields)
  };

  const updates = await buildIcalSourceData(merged);

  const source = await IcalSource.findByIdAndUpdate(
    sourceId,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate("roomId", "name code totalUnits")
    .populate("channelId", "name type isActive");

  return source;
};

export const deleteIcalSource = async (sourceId) => {
  validateObjectId(sourceId, "icalSourceId");

  const source = await IcalSource.findByIdAndUpdate(
    sourceId,
    { $set: { isActive: false } },
    { new: true, runValidators: true }
  )
    .populate("roomId", "name code totalUnits")
    .populate("channelId", "name type isActive");

  if (!source) {
    throw new NotFoundError("iCal source not found");
  }

  return source;
};

const getDuplicateQuery = (bookingPayload) => {
  const query = {
    externalId: bookingPayload.externalId
  };

  if (bookingPayload.propertyId) {
    query.propertyId = bookingPayload.propertyId;
  }

  if (bookingPayload.channelId) {
    query.channelId = bookingPayload.channelId;
    return query;
  }

  query.$or = [
    { sourceName: bookingPayload.sourceName },
    { source: bookingPayload.sourceName }
  ];

  return query;
};

const hasExistingBooking = async (bookingPayload) => {
  return Booking.exists(getDuplicateQuery(bookingPayload));
};

const getSyncReferenceTime = (icalSource) => {
  return icalSource.lastSyncedAt || icalSource.createdAt;
};

const minutesBetween = (fromDate, toDate) => {
  return Math.floor((toDate.getTime() - new Date(fromDate).getTime()) / 60000);
};

const createDelayAlertIfNeeded = async (icalSource, now = new Date()) => {
  if (!icalSource._id) {
    return null;
  }

  const config = await Config.findOne(
    icalSource.propertyId ? { propertyId: icalSource.propertyId } : {}
  );

  if (!config) {
    return null;
  }

  const syncReferenceTime = getSyncReferenceTime(icalSource);

  if (!syncReferenceTime) {
    return null;
  }

  const delayedMinutes = minutesBetween(syncReferenceTime, now);

  if (delayedMinutes <= config.syncDelayThresholdMinutes) {
    return null;
  }

  return createSyncDelayAlert({
    source: icalSource,
    delayedMinutes,
    thresholdMinutes: config.syncDelayThresholdMinutes
  });
};

const persistLastSyncedAt = async (icalSource, syncedAt) => {
  if (typeof icalSource.save === "function") {
    icalSource.lastSyncedAt = syncedAt;
    await icalSource.save();
    return;
  }

  if (icalSource._id) {
    await IcalSource.findByIdAndUpdate(icalSource._id, {
      lastSyncedAt: syncedAt
    });
  }
};

export const transformToBooking = (event, icalSource) => {
  const externalId = getEventExternalId(event);

  if (!externalId) {
    throw new ValidationError("iCal event uid is required");
  }

  if (!icalSource.roomId) {
    throw new ValidationError("iCal source roomId is required");
  }

  if (!icalSource.channelId && !icalSource.sourceName) {
    throw new ValidationError("iCal source channelId or sourceName is required");
  }

  if (!icalSource.roomCount) {
    throw new ValidationError("iCal source roomCount is required");
  }

  const { checkIn, checkOut } = parseStayDates({
    checkIn: event.start,
    checkOut: event.end
  });

  return {
    propertyId: icalSource.propertyId,
    roomId: icalSource.roomId,
    channelId: icalSource.channelId,
    sourceName: icalSource.sourceName,
    externalId,
    guestName: event.summary,
    roomCount: icalSource.roomCount,
    checkIn,
    checkOut,
    status: "confirmed",
    rawPayload: {
      uid: externalId,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end
    }
  };
};

export const syncIcal = async (icalSource) => {
  const url = getSourceUrl(icalSource);

  if (!url) {
    throw new ValidationError("iCal source url is required");
  }

  await createDelayAlertIfNeeded(icalSource);

  const data = await fetchIcalData(url);
  const events = parseEvents(data);
  const result = {
    sourceId: icalSource._id,
    sourceName: icalSource.sourceName,
    fetched: events.length,
    inserted: 0,
    skipped: 0,
    rejected: 0,
    conflicts: 0,
    errors: []
  };

  for (const event of events) {
    let bookingPayload;

    try {
      bookingPayload = transformToBooking(event, icalSource);

      if (await hasExistingBooking(bookingPayload)) {
        result.skipped++;
        continue;
      }

      await createBooking(bookingPayload);
      result.inserted++;
    } catch (error) {
      result.rejected++;

      if (error instanceof BookingConflictError || error.name === "BookingConflictError") {
        result.conflicts++;
      }

      result.errors.push({
        externalId: bookingPayload?.externalId || getEventExternalId(event),
        message: error.message,
        details: error.details
      });
    }
  }

  await persistLastSyncedAt(icalSource, new Date());

  return result;
};

export const syncAllIcalSources = async () => {
  const sources = await IcalSource.find({ isActive: true });
  const result = {
    sources: sources.length,
    inserted: 0,
    skipped: 0,
    rejected: 0,
    conflicts: 0,
    results: [],
    errors: []
  };

  for (const source of sources) {
    try {
      const sourceResult = await syncIcal(source);

      result.inserted += sourceResult.inserted;
      result.skipped += sourceResult.skipped;
      result.rejected += sourceResult.rejected;
      result.conflicts += sourceResult.conflicts;
      result.results.push(sourceResult);
    } catch (error) {
      result.errors.push({
        sourceId: source._id,
        sourceName: source.sourceName,
        message: error.message
      });
    }
  }

  return result;
};

export const syncIcalFromPayload = async (payload = {}) => {
  if (payload.icalSourceId) {
    const source = await IcalSource.findById(payload.icalSourceId);

    if (!source) {
      throw new NotFoundError("iCal source not found");
    }

    return syncIcal(source);
  }

  if (Object.keys(payload).length > 0) {
    return syncIcal(payload);
  }

  return syncAllIcalSources();
};

export const fetchICal = async (url) => {
  const data = await fetchIcalData(url);

  return parseEvents(data).map((event) => ({
    uid: getEventExternalId(event),
    summary: event.summary,
    start: event.start,
    end: event.end
  }));
};
