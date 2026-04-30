import { fetchICal } from "../services/icalService.js";
import { syncBookings } from "../services/bookingService.js";
import Property from "../models/Property.js";

export const syncICal = async (req, res) => {
  try {
    const { url, propertyId, roomId, sourceName } = req.body;

    if (!url || !propertyId) {
      return res.status(400).json({
        error: "url and propertyId required"
      });
    }

    const events = await fetchICal(url);

    const result = await syncBookings({
      events,
      propertyId,
      roomId,
      sourceName: sourceName || "OTA"
    });

    res.json({
      message: "Sync success",
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
