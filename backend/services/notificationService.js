import nodemailer from "nodemailer";

const hasSmtpConfig = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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

export const notifyBookingSuccessful = async (booking) => {
  const lines = [
    "Booking successful",
    `Guest: ${booking.guestName || "-"}`,
    `Source: ${booking.sourceName || booking.source || "-"}`,
    `Check-in: ${formatDate(booking.checkIn)}`,
    `Check-out: ${formatDate(booking.checkOut)}`,
    `Rooms: ${booking.roomCount || "-"}`,
    `Promo: ${booking.promo || booking.promoCode || "-"}`,
    `Notes: ${booking.notes || "-"}`
  ];

  return sendEmailNotification({
    subject: "Booking successful",
    text: lines.join("\n")
  });
};

export const notifyAlertCreated = async (alert) => {
  const lines = [
    `Alert: ${alert.type}`,
    `Severity: ${alert.severity}`,
    `Message: ${alert.message}`,
    `Room: ${alert.roomId || "-"}`,
    `Details: ${JSON.stringify(alert.metadata || {}, null, 2)}`
  ];

  return sendEmailNotification({
    subject: `Booking alert: ${alert.type}`,
    text: lines.join("\n")
  });
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
