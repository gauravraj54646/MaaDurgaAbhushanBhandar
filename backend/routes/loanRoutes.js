const express = require('express');
const mongoose = require('mongoose');
const {
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  getLoanAnalytics,
  getLoanFinancials,
} = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Guards against malformed :id values (e.g. "abc") which would
// otherwise throw a Mongoose CastError deep in findById and surface
// as a misleading 500 — this turns it into a clean 404 up front.
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Loan not found' });
  }
  next();
};

router.route('/').get(protect, admin, getLoans).post(protect, admin, createLoan);

// MUST come before '/:id' — otherwise Express treats "analytics"
// as the :id value and this route is never reached.
router.get('/analytics', protect, admin, getLoanAnalytics);

// Password re-verification required in the controller before this
// releases the financial totals — see getLoanFinancials.
router.post('/analytics/financials', protect, admin, getLoanFinancials);

router
  .route('/:id')
  .get(validateObjectId, protect, admin, getLoanById)
  .put(validateObjectId, protect, admin, updateLoan)
  .delete(validateObjectId, protect, admin, deleteLoan);

module.exports = router;