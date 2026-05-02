import dotenv from "dotenv";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.join(__dirname, "fixtures", "dummy-bookings.ics");

const results = [];

const log = (message, details = "") => {
  const suffix = details ? ` ${details}` : "";
  console.log(`${new Date().toISOString()} ${message}${suffix}`);
};

const pass = (label, details = "") => {
  results.push({ status: "PASS", label, details });
  log(`PASS ${label}`, details);
};

const skip = (label, details = "") => {
  results.push({ status: "SKIP", label, details });
  log(`SKIP ${label}`, details);
};

const assertPass = (label, condition, details = "") => {
  if (!condition) {
    const error = new Error(`${label}${details ? `: ${details}` : ""}`);
    error.validationLabel = label;
    throw error;
  }

  pass(label, details);
};

const formatCalendarDate = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const deriveTestMongoUri = () => {
  if (process.env.TEST_MONGO_URI) {
    return process.env.TEST_MONGO_URI;
  }

  const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/booking-sync";
  const url = new URL(baseUri);
  const dbName = url.pathname.replace("/", "") || "booking-sync";

  url.pathname = `/${dbName}-e2e-test`;

  return url.toString();
};

const assertSafeTestDatabase = (mongoUri) => {
  const dbName = new URL(mongoUri).pathname.replace("/", "");

  if (!/(test|e2e)/i.test(dbName) && process.env.ALLOW_NON_TEST_DB !== "true") {
    throw new Error(
      `Refusing to run E2E validation against non-test database "${dbName}". Set TEST_MONGO_URI to a test DB.`
    );
  }

  return dbName;
};

const startIcalFixtureServer = async () => {
  const fixture = await readFile(fixturePath);
  const server = createServer((req, res) => {
    if (req.url === "/dummy-bookings.ics") {
      res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" });
      res.end(fixture);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address();

  return {
    server,
    url: `http://127.0.0.1:${port}/dummy-bookings.ics`
  };
};

const closeServer = async (server) => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const expectError = async (label, action, validateError) => {
  try {
    await action();
  } catch (error) {
    assertPass(label, validateError(error), error.message);
    return error;
  }

  throw new Error(`${label}: expected an error but none was thrown`);
};

const hasSmtpConfig = () => {
  return Boolean(
    process.env.ADMIN_EMAIL
    && process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
  );
};

const hasGoogleConfig = () => {
  return existsSync(path.resolve("config/google-service-account.json"));
};

const printSummary = () => {
  const passed = results.filter((result) => result.status === "PASS").length;
  const skipped = results.filter((result) => result.status === "SKIP").length;

  console.log("\nE2E VALIDATION SUMMARY");
  console.table(results);
  console.log(`Passed: ${passed}`);
  console.log(`Skipped: ${skipped}`);
};

const run = async () => {
  const mongoUri = deriveTestMongoUri();
  const dbName = assertSafeTestDatabase(mongoUri);
  let fixtureServer;

  const [
    { default: Room },
    { default: Channel },
    { default: Config },
    { default: Booking },
    { default: Alert },
    { default: Promo },
    { default: IcalSource },
    { fetchIcalData, parseEvents, syncIcal },
    { createBooking },
    { getAvailability },
    { sendEmailNotification },
    { deleteEvent }
  ] = await Promise.all([
    import("../models/Room.js"),
    import("../models/Channel.js"),
    import("../models/Config.js"),
    import("../models/Booking.js"),
    import("../models/Alert.js"),
    import("../models/Promo.js"),
    import("../models/IcalSource.js"),
    import("../services/icalService.js"),
    import("../services/bookingService.js"),
    import("../services/availabilityService.js"),
    import("../services/notificationService.js"),
    import("../services/googleCalendarService.js")
  ]);

  try {
    log("STEP 0 Connecting to isolated test database", dbName);
    await mongoose.connect(mongoUri);
    await mongoose.connection.dropDatabase();
    pass("Test database reset", dbName);

    log("STEP 1 Starting dummy iCal fixture server");
    fixtureServer = await startIcalFixtureServer();
    pass("Dummy iCal URL ready", fixtureServer.url);

    const room = await Room.create({
      name: "E2E Deluxe Room",
      code: "E2E-DELUXE",
      totalUnits: 1,
      maxGuestsPerUnit: 2,
      isActive: true
    });
    const channel = await Channel.create({
      name: "E2E OTA",
      type: "OTA",
      isActive: true
    });
    const promo = await Promo.create({
      name: "E2E Breakfast Included",
      description: "Breakfast promo used by automated validation",
      isActive: true
    });
    await Config.create({
      lowAvailabilityThreshold: 0,
      syncDelayThresholdMinutes: 5
    });
    const icalSource = await IcalSource.create({
      url: fixtureServer.url,
      roomId: room._id,
      channelId: channel._id,
      sourceName: channel.name,
      roomCount: 1,
      isActive: true
    });
    pass("Seeded room, channel, promo, config, and iCal source");

    log("STEP 2 Fetching and parsing iCal via node-ical");
    const icalData = await fetchIcalData(fixtureServer.url);
    const events = parseEvents(icalData);
    const eventUids = events.map((event) => event.uid);
    assertPass("Parsed expected event count", events.length === 3, `events=${events.length}`);
    assertPass(
      "Extracted UID as externalId candidate",
      eventUids.includes("e2e-normal-001@forest-cabin.test")
    );
    assertPass(
      "Parsed correct first start/end dates",
      formatCalendarDate(events[0].start) === "2026-07-01"
        && formatCalendarDate(events[0].end) === "2026-07-03",
      `${formatCalendarDate(events[0].start)} -> ${formatCalendarDate(events[0].end)}`
    );

    log("STEP 3 Syncing iCal events into MongoDB");
    const syncResult = await syncIcal(icalSource);
    console.log("Sync result:", syncResult);
    assertPass("Fetched all iCal events during sync", syncResult.fetched === 3);
    assertPass("Inserted non-conflicting bookings", syncResult.inserted === 2, `inserted=${syncResult.inserted}`);
    assertPass("Rejected overlapping booking", syncResult.rejected === 1, `rejected=${syncResult.rejected}`);
    assertPass("Reported one conflict", syncResult.conflicts === 1, `conflicts=${syncResult.conflicts}`);

    const insertedBookings = await Booking.find({
      externalId: { $in: eventUids }
    }).populate("roomId", "name").populate("channelId", "name");
    assertPass("Stored only non-duplicate valid bookings", insertedBookings.length === 2);
    assertPass(
      "Mapped iCal booking to selected room",
      insertedBookings.every((booking) => String(booking.roomId._id) === String(room._id))
    );
    assertPass(
      "Mapped iCal booking to selected sourceName",
      insertedBookings.every((booking) => booking.sourceName === channel.name)
    );

    const duplicateSyncResult = await syncIcal(icalSource);
    console.log("Duplicate sync result:", duplicateSyncResult);
    const duplicateCount = await Booking.countDocuments({
      externalId: { $in: ["e2e-normal-001@forest-cabin.test", "e2e-normal-003@forest-cabin.test"] }
    });
    assertPass("Second sync skipped existing bookings", duplicateSyncResult.skipped === 2);
    assertPass("No duplicate bookings inserted by UID", duplicateCount === 2, `count=${duplicateCount}`);

    log("STEP 4 Validating availability and HTTP-409-style conflict");
    const availability = await getAvailability({
      roomId: room._id,
      checkIn: new Date("2026-07-01"),
      checkOut: new Date("2026-07-03")
    });
    assertPass("Calculated total room capacity", availability.totalRooms === 1);
    assertPass("Calculated booked room count", availability.bookedRooms === 1);
    assertPass("Calculated zero available rooms", availability.availableRooms === 0);

    await expectError(
      "Overbooking returns 409 conflict error",
      () => createBooking({
        roomId: room._id,
        channelId: channel._id,
        sourceName: channel.name,
        externalId: "e2e-direct-overlap@forest-cabin.test",
        guestName: "E2E Direct Overlap",
        roomCount: 1,
        checkIn: "2026-07-02",
        checkOut: "2026-07-03"
      }),
      (error) => error.statusCode === 409 && error.name === "BookingConflictError"
    );

    log("STEP 5 Validating alert system");
    const alerts = await Alert.find({}).sort({ createdAt: 1 });
    const lowAvailabilityAlert = alerts.find((alert) => alert.type === "LOW_AVAILABILITY");
    const overbookingAlert = alerts.find((alert) => alert.type === "OVERBOOKING_ATTEMPT");
    assertPass(
      "LOW_AVAILABILITY alert created",
      lowAvailabilityAlert?.message === "Room availability is below configured threshold"
    );
    assertPass("LOW_AVAILABILITY severity is warning", lowAvailabilityAlert?.severity === "warning");
    assertPass(
      "OVERBOOKING_ATTEMPT alert created",
      overbookingAlert?.message === "Booking rejected because requested rooms exceed availability"
    );
    assertPass("OVERBOOKING_ATTEMPT severity is critical", overbookingAlert?.severity === "critical");

    log("STEP 6 Creating direct booking with promo and notes");
    const directBooking = await createBooking({
      roomId: room._id,
      channelId: channel._id,
      sourceName: channel.name,
      externalId: "e2e-direct-success@forest-cabin.test",
      guestName: "E2E Promo Guest",
      roomCount: 1,
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      promoId: promo._id,
      notes: "Late check-in. Promo should appear in email and calendar details."
    });
    assertPass("Stored promoId on booking", directBooking.promoId?.name === promo.name);
    assertPass("Stored notes on booking", directBooking.notes.includes("Late check-in"));

    log("STEP 7 Validating email notification path");
    if (hasSmtpConfig()) {
      const emailResult = await sendEmailNotification({
        subject: "E2E Forest Cabin notification test",
        text: [
          "Booking successful",
          `Guest: ${directBooking.guestName}`,
          `Promo: ${directBooking.promoId?.name}`,
          `Alert: ${overbookingAlert.message}`
        ].join("\n")
      });
      assertPass(
        "Email notification sent",
        Boolean(emailResult?.messageId || emailResult?.accepted?.length),
        emailResult?.messageId || ""
      );
    } else {
      skip("Email notification send", "SMTP env vars or ADMIN_EMAIL missing");
    }

    log("STEP 8 Validating Google Calendar integration path");
    if (hasGoogleConfig()) {
      assertPass(
        "Google Calendar event created after successful booking",
        Boolean(directBooking.googleCalendarEventId),
        `eventId=${directBooking.googleCalendarEventId || "-"}`
      );

      if (directBooking.googleCalendarEventId) {
        await deleteEvent(directBooking.googleCalendarEventId);
        pass("Cleaned up E2E Google Calendar event", directBooking.googleCalendarEventId);
      }
    } else {
      skip("Google Calendar real API validation", "config/google-service-account.json missing");
      assertPass(
        "Booking survives missing Google Calendar credentials",
        Boolean(directBooking._id),
        "createBooking completed"
      );
    }

    log("STEP 9 Validating error handling");
    await expectError(
      "Invalid iCal URL fails without crashing",
      () => fetchIcalData("not-a-valid-url"),
      (error) => Boolean(error)
    );
    await expectError(
      "Duplicate booking returns 409 conflict error",
      () => createBooking({
        roomId: room._id,
        channelId: channel._id,
        sourceName: channel.name,
        externalId: "e2e-direct-success@forest-cabin.test",
        guestName: "E2E Duplicate Guest",
        roomCount: 1,
        checkIn: "2026-08-10",
        checkOut: "2026-08-12"
      }),
      (error) => error.statusCode === 409 && error.name === "ConflictError"
    );

    if (hasGoogleConfig()) {
      await expectError(
        "Google API failure is catchable by caller",
        () => deleteEvent("definitely-not-a-real-e2e-event-id"),
        (error) => Boolean(error)
      );
    } else {
      skip("Google API failure response", "Google credentials missing");
    }

    log("STEP 10 End-to-end validation completed");
    printSummary();
  } catch (error) {
    console.error("\nE2E VALIDATION FAILED");
    console.error(error.stack || error.message);
    printSummary();
    process.exitCode = 1;
  } finally {
    await closeServer(fixtureServer?.server);
    await mongoose.disconnect();
  }
};

run();
