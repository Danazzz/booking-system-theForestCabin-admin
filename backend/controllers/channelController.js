import {
  createChannel,
  deleteChannel,
  getChannelById,
  listChannels,
  updateChannel
} from "../services/channelService.js";

const sendError = (res, error) => {
  const statusCode = error.statusCode
    || (error.code === 11000 ? 409 : null)
    || (["ValidationError", "CastError"].includes(error.name) ? 400 : 500);

  res.status(statusCode).json({
    error: error.message,
    details: error.details
  });
};

export const createChannelController = async (req, res) => {
  try {
    const channel = await createChannel(req.body);

    res.status(201).json({ data: channel });
  } catch (error) {
    sendError(res, error);
  }
};

export const listChannelsController = async (req, res) => {
  try {
    const channels = await listChannels(req.query);

    res.json({ data: channels });
  } catch (error) {
    sendError(res, error);
  }
};

export const getChannelController = async (req, res) => {
  try {
    const channel = await getChannelById(req.params.id);

    res.json({ data: channel });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateChannelController = async (req, res) => {
  try {
    const channel = await updateChannel(req.params.id, req.body);

    res.json({ data: channel });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteChannelController = async (req, res) => {
  try {
    const channel = await deleteChannel(req.params.id);

    res.json({
      message: "Channel disabled",
      data: channel
    });
  } catch (error) {
    sendError(res, error);
  }
};
