import cron from "node-cron";
import IcalSource from "../models/IcalSource.js";
import { fetchICal } from "../services/icalService.js";
import { syncBookings } from "../services/bookingService.js";

export const startSyncJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    console.log("Running iCal sync...");

    const sources = await IcalSource.find({ isActive: true });

    for (const source of sources) {
      try {
        const events = await fetchICal(source.icalUrl);

        const result = await syncBookings({
          events,
          propertyId: source.propertyId,
          roomId: source.roomId,
          sourceName: source.sourceName
        });

        console.log(
          `[${source.sourceName}] inserted: ${result.inserted}`
        );

      } catch (error) {
        console.error("Sync error:", error.message);
      }
    }
  });
};
