const express = require('express');
const { getLoans, getLoanById, createLoan, updateLoan, deleteLoan } = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

router.route('/').get(getLoans).post(protect, admin, createLoan);
router.route('/:id').get(getLoanById).put(protect, admin, updateLoan).delete(protect, admin, deleteLoan);

module.exports = router;