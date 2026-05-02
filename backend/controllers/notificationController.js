import { sendTestEmailNotification } from "../services/notificationService.js";

const sendError = (res, error) => {
  res.status(error.statusCode || 500).json({
    error: error.message,
    details: error.details
  });
};

export const sendTestNotificationController = async (req, res) => {
  try {
    const result = await sendTestEmailNotification();

    res.json({
      message: result.sent
        ? "Test notification sent"
        : "Test notification skipped. Email config is missing or failed.",
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};
