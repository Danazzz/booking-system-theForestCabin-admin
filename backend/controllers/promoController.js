import {
  createPromo,
  deletePromo,
  getPromoById,
  listPromos,
  updatePromo
} from "../services/promoService.js";

const sendError = (res, error) => {
  const statusCode = error.statusCode
    || (error.code === 11000 ? 409 : null)
    || (["ValidationError", "CastError"].includes(error.name) ? 400 : 500);

  res.status(statusCode).json({
    error: error.message,
    details: error.details
  });
};

export const createPromoController = async (req, res) => {
  try {
    const promo = await createPromo(req.body);

    res.status(201).json({ data: promo });
  } catch (error) {
    sendError(res, error);
  }
};

export const listPromosController = async (req, res) => {
  try {
    const promos = await listPromos(req.query);

    res.json({ data: promos });
  } catch (error) {
    sendError(res, error);
  }
};

export const getPromoController = async (req, res) => {
  try {
    const promo = await getPromoById(req.params.id);

    res.json({ data: promo });
  } catch (error) {
    sendError(res, error);
  }
};

export const updatePromoController = async (req, res) => {
  try {
    const promo = await updatePromo(req.params.id, req.body);

    res.json({ data: promo });
  } catch (error) {
    sendError(res, error);
  }
};

export const deletePromoController = async (req, res) => {
  try {
    const promo = await deletePromo(req.params.id);

    res.json({
      message: "Promo disabled",
      data: promo
    });
  } catch (error) {
    sendError(res, error);
  }
};
