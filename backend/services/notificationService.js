import nodemailer from "nodemailer";

const hasSmtpConfig = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

export const isEmailNotificationConfigured = () => {
  return Boolean(hasSmtpConfig() && process.env.ADMIN_EMAIL);
};

const createTransporter = () => {
  if (!hasSmtpConfig()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

export const sendEmailNotification = async ({ subject, text, html }) => {
  const transporter = createTransporter();
  const to = process.env.ADMIN_EMAIL;

  if (!transporter || !to) {
    console.warn("Email notification skipped: SMTP config or ADMIN_EMAIL missing");
    return null;
  }

  try {
    return await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error("Email notification failed:", error.message);
    return null;
  }
};

const formatDate = (value) => {
  return value ? new Date(value).toISOString().slice(0, 10) : "-";
};

const getPromoLabel = (booking) => {
  return booking.promoId?.name || booking.promo || booking.promoCode || "-";
};

const getRoomLabel = (value) => {
  return value?.name || value?.code || value || "-";
};

const getDateRange = ({ checkIn, checkOut }) => {
  return `${formatDate(checkIn)} to ${formatDate(checkOut)}`;
};

export const notifyBookingSuccessful = async (booking) => {
  const dateRange = getDateRange(booking);
  const preview = `BOOKING: ${booking.guestName || "Guest"} from ${booking.sourceName || booking.source || "source"} for ${dateRange}.`;
  const lines = [
    preview,
    "",
    "Booking details",
    `Guest: ${booking.guestName || "-"}`,
    `Source: ${booking.sourceName || booking.source || "-"}`,
    `Check-in: ${formatDate(booking.checkIn)}`,
    `Check-out: ${formatDate(booking.checkOut)}`,
    `Rooms: ${booking.roomCount || "-"}`,
    `Promo: ${getPromoLabel(booking)}`,
    `Notes: ${booking.notes || "-"}`
  ];

  return sendEmailNotification({
    subject: `[FOREST CABIN BOOKING] ${booking.guestName || "New Booking"} - ${dateRange}`,
    text: lines.join("\n")
  });
};

export const notifyAlertCreated = async (alert) => {
  const severity = String(alert.severity || "warning").toUpperCase();
  const metadata = alert.metadata || {};
  const dateRange = getDateRange({
    checkIn: metadata.checkIn,
    checkOut: metadata.checkOut
  });
  const preview = `${severity}: ${alert.message}${dateRange !== "- to -" ? ` (${dateRange})` : ""}.`;
  const lines = [
    preview,
    "",
    "Alert details",
    `Alert: ${alert.type}`,
    `Severity: ${alert.severity}`,
    `Message: ${alert.message}`,
    `Room: ${getRoomLabel(alert.roomId)}`,
    `Source: ${metadata.sourceName || "-"}`,
    `Available rooms: ${metadata.availableRooms ?? "-"}`,
    `Requested rooms: ${metadata.requestedRooms ?? "-"}`,
    `Details: ${JSON.stringify(metadata, null, 2)}`
  ];

  return sendEmailNotification({
    subject: `[FOREST CABIN ${severity}] ${alert.type}`,
    text: lines.join("\n")
  });
};

export const sendTestEmailNotification = async () => {
  const preview = "TEST: Forest Cabin admin email notifications are working.";
  const result = await sendEmailNotification({
    subject: "[FOREST CABIN TEST] Admin Email Notification",
    text: [
      preview,
      "",
      "If this appeared on the admin phone, email alerts are ready.",
      `Sent at: ${new Date().toISOString()}`
    ].join("\n")
  });

  return {
    sent: Boolean(result),
    configured: isEmailNotificationConfigured(),
    messageId: result?.messageId
  };
};

export const pushNotificationBlueprint = {
  provider: "future",
  payloadShape: {
    title: "string",
    body: "string",
    alertId: "string",
    bookingId: "string"
  },
  storage: "Store device/browser subscriptions in a future NotificationSubscription model"
};
