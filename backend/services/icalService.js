import ical from "node-ical";
import Booking from "../models/Booking.js";
import Config from "../models/Config.js";
import IcalSource from "../models/IcalSource.js";
import { createSyncDelayAlert } from "./alertService.js";
import { createBooking } from "./bookingService.js";
import { BookingConflictError, NotFoundError, ValidationError } from "./bookingErrors.js";
import { parseStayDates } from "./availabilityService.js";

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
