import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { UnauthorizedError, ValidationError } from "./bookingErrors.js";

const tokenExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

const normalizeUsername = (username) => {
  return username?.trim().toLowerCase();
};

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
};

export const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    getJwtSecret(),
    { expiresIn: tokenExpiresIn }
  );
};

export const registerUser = async ({ username, password, name }) => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password || !name) {
    throw new ValidationError("username, password, and name are required");
  }

  const existingAdmin = await User.exists({});

  if (existingAdmin) {
    throw new ValidationError("Admin user already exists");
  }

  const existingUser = await User.findOne({ username: normalizedUsername });

  if (existingUser) {
    throw new ValidationError("Username is already registered");
  }

  const user = await User.create({
    username: normalizedUsername,
    password,
    name
  });
  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      username: user.username,
      name: user.name
    },
    token
  };
};

export const loginUser = async ({ username, password }) => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    throw new ValidationError("username and password are required");
  }

  const user = await User.findOne({ username: normalizedUsername }).select("+password");

  if (!user) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid username or password");
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      username: user.username,
      name: user.name
    },
    token
  };
};
