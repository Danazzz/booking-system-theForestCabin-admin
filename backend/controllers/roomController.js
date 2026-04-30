import {
  createRoom,
  deleteRoom,
  getRoomById,
  listRooms,
  updateRoom
} from "../services/roomService.js";

const sendError = (res, error) => {
  const statusCode = error.statusCode
    || (error.code === 11000 ? 409 : null)
    || (["ValidationError", "CastError"].includes(error.name) ? 400 : 500);

  res.status(statusCode).json({
    error: error.message,
    details: error.details
  });
};

export const createRoomController = async (req, res) => {
  try {
    const room = await createRoom(req.body);

    res.status(201).json({ data: room });
  } catch (error) {
    sendError(res, error);
  }
};

export const listRoomsController = async (req, res) => {
  try {
    const rooms = await listRooms(req.query);

    res.json({ data: rooms });
  } catch (error) {
    sendError(res, error);
  }
};

export const getRoomController = async (req, res) => {
  try {
    const room = await getRoomById(req.params.id);

    res.json({ data: room });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateRoomController = async (req, res) => {
  try {
    const room = await updateRoom(req.params.id, req.body);

    res.json({ data: room });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteRoomController = async (req, res) => {
  try {
    const room = await deleteRoom(req.params.id);

    res.json({
      message: "Room deleted",
      data: room
    });
  } catch (error) {
    sendError(res, error);
  }
};
