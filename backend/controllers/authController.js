import { loginUser, registerUser } from "../services/authService.js";

const sendError = (res, error) => {
  res.status(error.statusCode || 500).json({
    error: error.message,
    details: error.details
  });
};

export const registerController = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      message: "Admin registered",
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const loginController = async (req, res) => {
  try {
    const result = await loginUser(req.body);

    res.json({
      message: "Login successful",
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};
