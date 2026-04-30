import cron from "node-cron";
import { syncAllIcalSources } from "../services/icalService.js";

export const startSyncJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("Running iCal sync...");

      const result = await syncAllIcalSources();

      console.log(
        `iCal sync completed. sources: ${result.sources}, inserted: ${result.inserted}, skipped: ${result.skipped}, rejected: ${result.rejected}`
      );
    } catch (error) {
      console.error("Sync job error:", error.message);
    }
  });
};
