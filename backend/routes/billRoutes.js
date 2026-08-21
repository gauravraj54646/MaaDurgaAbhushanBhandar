const express = require('express');
const mongoose = require('mongoose');
const {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
} = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Guards against malformed :id values (e.g. "abc") which would
// otherwise throw a Mongoose CastError deep in findById and surface
// as a misleading 500 — this turns it into a clean 404 up front.
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  next();
};

router.route('/').get(protect, admin, getBills).post(protect, admin, createBill);

router
  .route('/:id')
  .get(validateObjectId, protect, admin, getBillById)
  .put(validateObjectId, protect, admin, updateBill)
  .delete(validateObjectId, protect, admin, deleteBill);

module.exports = router;