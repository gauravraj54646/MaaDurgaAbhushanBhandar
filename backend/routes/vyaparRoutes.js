const express = require("express");
const mongoose = require("mongoose");
const {
  getVyapars,
  getVyaparById,
  createVyapar,
  updateVyapar,
  addFinePayment,
  deleteVyapar,
} = require("../controllers/vyaparController");
const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

// Guards against malformed :id/:itemId values (e.g. "abc") which
// would otherwise throw a Mongoose CastError deep in the query and
// surface as a misleading 500 — this turns it into a clean 404 up
// front. paramName lets it validate either :id or :itemId.
const validateObjectId = (paramName) => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return res.status(404).json({ message: "Record not found" });
  }
  next();
};

router
  .route("/")
  .get(protect, admin, getVyapars)
  .post(protect, admin, createVyapar);

router
  .route("/:id")
  .get(validateObjectId("id"), protect, admin, getVyaparById)
  .put(validateObjectId("id"), protect, admin, updateVyapar)
  .delete(validateObjectId("id"), protect, admin, deleteVyapar);

// Records one dated fine-weight settlement against a single item —
// see addFinePayment in the controller for why this exists separately
// from PUT /:id (which replaces the whole items array).
router.post(
  "/:id/items/:itemId/fine-payments",
  validateObjectId("id"),
  validateObjectId("itemId"),
  protect,
  admin,
  addFinePayment,
);

module.exports = router;
