import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "config/google-service-account.json",
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

const calendar = google.calendar({ version: "v3", auth });

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

const getPromoLabel = (booking) => {
  return booking.promoId?.name || booking.promo || booking.promoCode || "-";
};

const buildDescription = (booking) => {
  return [
    `Booking from ${booking.sourceName || booking.source || "-"}`,
    `Guest: ${booking.guestName || "-"}`,
    `Promo: ${getPromoLabel(booking)}`,
    `Notes: ${booking.notes || "-"}`
  ].join("\n");
};

export const createEvent = async (booking) => {
  const event = {
    summary: `${booking.guestName || "Guest"} / booking`,
    description: buildDescription(booking),
    start: {
      date: booking.checkIn.toISOString().split("T")[0]
    },
    end: {
      date: booking.checkOut.toISOString().split("T")[0]
    }
  };

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event
  });

  return response.data.id;
};

export const updateEvent = async (eventId, booking) => {
  await calendar.events.update({
    calendarId: CALENDAR_ID,
    eventId,
    resource: {
      summary: `${booking.guestName || "Guest"} / booking`,
      description: buildDescription(booking),
      start: { date: booking.checkIn.toISOString().split("T")[0] },
      end: { date: booking.checkOut.toISOString().split("T")[0] }
    }
  });
};

export const deleteEvent = async (eventId) => {
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId
  });
};
