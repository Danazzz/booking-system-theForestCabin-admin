import {
  createIcalSource,
  deleteIcalSource,
  getIcalSourceById,
  listIcalSources,
  syncIcalFromPayload,
  updateIcalSource
} from "../services/icalService.js";

const sendError = (res, error) => {
  const statusCode = error.statusCode
    || (["ValidationError", "CastError"].includes(error.name) ? 400 : 500);

  res.status(statusCode).json({
    error: error.message,
    details: error.details
  });
};

export const syncICal = async (req, res) => {
  try {
    const result = await syncIcalFromPayload(req.body);

    res.json({
      message: "iCal sync completed",
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const createIcalSourceController = async (req, res) => {
  try {
    const source = await createIcalSource(req.body);

    res.status(201).json({ data: source });
  } catch (error) {
    sendError(res, error);
  }
};

export const listIcalSourcesController = async (req, res) => {
  try {
    const sources = await listIcalSources(req.query);

    res.json({ data: sources });
  } catch (error) {
    sendError(res, error);
  }
};

export const getIcalSourceController = async (req, res) => {
  try {
    const source = await getIcalSourceById(req.params.id);

    res.json({ data: source });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateIcalSourceController = async (req, res) => {
  try {
    const source = await updateIcalSource(req.params.id, req.body);

    res.json({ data: source });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteIcalSourceController = async (req, res) => {
  try {
    const source = await deleteIcalSource(req.params.id);

    res.json({
      message: "iCal source disabled",
      data: source
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const syncIcalSourceController = async (req, res) => {
  try {
    const result = await syncIcalFromPayload({ icalSourceId: req.params.id });

    res.json({
      message: "iCal source sync completed",
      data: result
    });
  } catch (error) {
    sendError(res, error);
  }
};
