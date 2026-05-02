import Alert from "../models/Alert.js";
import Config from "../models/Config.js";
import { notifyAlertCreated } from "./notificationService.js";
import { NotFoundError } from "./bookingErrors.js";

export const createAlert = async ({
  propertyId,
  roomId,
  type,
  message,
  severity,
  metadata = {}
}) => {
  const alert = await Alert.create({
    propertyId,
    roomId,
    type,
    message,
    severity,
    metadata,
    isRead: false
  });

  if (["LOW_AVAILABILITY", "OVERBOOKING_ATTEMPT"].includes(alert.type)) {
    await notifyAlertCreated(alert);
  }

  return alert;
};

export const getActiveAlerts = async (filters = {}) => {
  const query = { isRead: false };

  if (filters.propertyId) query.propertyId = filters.propertyId;
  if (filters.roomId) query.roomId = filters.roomId;
  if (filters.type) query.type = filters.type;

  return Alert.find(query)
    .populate("roomId", "name code")
    .sort({ createdAt: -1 });
};

export const markAsRead = async (alertId) => {
  const alert = await Alert.findByIdAndUpdate(
    alertId,
    { isRead: true },
    { new: true }
  );

  if (!alert) {
    throw new NotFoundError("Alert not found");
  }

  return alert;
};

export const createLowAvailabilityAlert = async (availability) => {
  const configQuery = availability.propertyId
    ? { propertyId: availability.propertyId }
    : {};
  const config = await Config.findOne(configQuery);

  if (!config) {
    return null;
  }

  if (availability.availableRooms > config.lowAvailabilityThreshold) {
    return null;
  }

  const existingAlertQuery = {
    roomId: availability.roomId,
    type: "LOW_AVAILABILITY",
    isRead: false,
    "metadata.checkIn": availability.checkIn,
    "metadata.checkOut": availability.checkOut
  };

  if (availability.propertyId) {
    existingAlertQuery.propertyId = availability.propertyId;
  }

  const existingAlert = await Alert.findOne(existingAlertQuery);

  if (existingAlert) {
    return existingAlert;
  }

  return createAlert({
    propertyId: availability.propertyId,
    roomId: availability.roomId,
    type: "LOW_AVAILABILITY",
    severity: "warning",
    message: "Room availability is below configured threshold",
    metadata: {
      availableRooms: availability.availableRooms,
      threshold: config.lowAvailabilityThreshold,
      totalRooms: availability.totalRooms,
      bookedRooms: availability.bookedRooms,
      checkIn: availability.checkIn,
      checkOut: availability.checkOut
    }
  });
};

export const createOverbookingAttemptAlert = async ({
  propertyId,
  roomId,
  channel,
  checkIn,
  checkOut,
  roomCount,
  conflictDetails = {},
  rawPayload
}) => {
  return createAlert({
    propertyId,
    roomId,
    type: "OVERBOOKING_ATTEMPT",
    severity: "critical",
    message: "Booking rejected because requested rooms exceed availability",
    metadata: {
      ...conflictDetails,
      requestedRooms: roomCount,
      checkIn,
      checkOut,
      channelId: channel?._id,
      sourceName: channel?.name,
      sourceType: channel?.type,
      externalId: rawPayload?.externalId
    }
  });
};

export const createSyncDelayAlert = async ({
  source,
  delayedMinutes,
  thresholdMinutes
}) => {
  const existingAlertQuery = {
    roomId: source.roomId,
    type: "SYNC_DELAY",
    isRead: false,
    "metadata.sourceId": source._id
  };

  if (source.propertyId) {
    existingAlertQuery.propertyId = source.propertyId;
  }

  const existingAlert = await Alert.findOne(existingAlertQuery);

  if (existingAlert) {
    return existingAlert;
  }

  return createAlert({
    propertyId: source.propertyId,
    roomId: source.roomId,
    type: "SYNC_DELAY",
    severity: "warning",
    message: "Booking source sync is delayed beyond configured threshold",
    metadata: {
      sourceId: source._id,
      sourceName: source.sourceName,
      lastSyncedAt: source.lastSyncedAt,
      delayedMinutes,
      thresholdMinutes
    }
  });
};
