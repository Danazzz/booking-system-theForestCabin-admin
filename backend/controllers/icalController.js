import { syncIcalFromPayload } from "../services/icalService.js";

export const syncICal = async (req, res) => {
  try {
    const result = await syncIcalFromPayload(req.body);

    res.json({
      message: "iCal sync completed",
      data: result
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details
    });
  }
};
