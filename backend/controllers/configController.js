import {
  createConfig,
  deleteConfig,
  getConfig,
  getConfigById,
  listConfigs,
  updateConfig,
  updateConfigById
} from "../services/configService.js";

const sendError = (res, error) => {
  const statusCode = error.statusCode
    || (error.code === 11000 ? 409 : null)
    || (["ValidationError", "CastError"].includes(error.name) ? 400 : 500);

  res.status(statusCode).json({
    error: error.message,
    details: error.details
  });
};

export const getConfigController = async (req, res) => {
  try {
    const config = await getConfig(req.query.propertyId);

    res.json({ data: config });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateConfigController = async (req, res) => {
  try {
    const config = await updateConfig(req.body);

    res.json({ data: config });
  } catch (error) {
    sendError(res, error);
  }
};

export const createConfigController = async (req, res) => {
  try {
    const config = await createConfig(req.body);

    res.status(201).json({ data: config });
  } catch (error) {
    sendError(res, error);
  }
};

export const listConfigsController = async (req, res) => {
  try {
    const configs = await listConfigs(req.query);

    res.json({ data: configs });
  } catch (error) {
    sendError(res, error);
  }
};

export const getConfigByIdController = async (req, res) => {
  try {
    const config = await getConfigById(req.params.id);

    res.json({ data: config });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateConfigByIdController = async (req, res) => {
  try {
    const config = await updateConfigById(req.params.id, req.body);

    res.json({ data: config });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteConfigController = async (req, res) => {
  try {
    const config = await deleteConfig(req.params.id);

    res.json({
      message: "Config deleted",
      data: config
    });
  } catch (error) {
    sendError(res, error);
  }
};
