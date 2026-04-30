import { getActiveAlerts, markAsRead } from "../services/alertService.js";

const sendError = (res, error) => {
  res.status(error.statusCode || 500).json({
    error: error.message,
    details: error.details
  });
};

export const getAlertsController = async (req, res) => {
  try {
    const alerts = await getActiveAlerts(req.query);

    res.json({ data: alerts });
  } catch (error) {
    sendError(res, error);
  }
};

export const markAlertReadController = async (req, res) => {
  try {
    const alert = await markAsRead(req.params.id);

    res.json({ data: alert });
  } catch (error) {
    sendError(res, error);
  }
};
