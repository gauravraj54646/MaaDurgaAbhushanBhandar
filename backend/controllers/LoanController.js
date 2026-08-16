const bcrypt = require('bcryptjs');
const LoanProduct = require('../models/LoanProduct');
const User = require('../models/User');
const { getLoanSummary } = require('../utils/loanCalculations');

const getLoans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      name, // partial, case-insensitive match
      fromDate, // inclusive lower bound on loan.date
      toDate, // inclusive upper bound on loan.date
      minAmount, // inclusive lower bound on loanAmount
      maxAmount, // inclusive upper bound on loanAmount
      sortBy = 'date', // 'date' | 'loanAmount' | 'name'
      sortOrder = 'desc', // 'asc' | 'desc'
    } = req.query;

    const filter = {};

    if (name) {
      filter.name = { $regex: name.trim(), $options: 'i' };
    }

    if (fromDate || toDate) {
      filter.date = {};

      if (fromDate) {
        filter.date.$gte = new Date(fromDate);
      }

      if (toDate) {
        // include the whole day for the "to" bound
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (minAmount || maxAmount) {
      filter.loanAmount = {};

      if (minAmount) {
        filter.loanAmount.$gte = Number(minAmount);
      }

      if (maxAmount) {
        filter.loanAmount.$lte = Number(maxAmount);
      }
    }

    // Only these fields may be sorted on — prevents arbitrary/unsafe
    // sort keys being passed in via query string.
    const allowedSortFields = ['date', 'loanAmount', 'name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [loans, total] = await Promise.all([
      LoanProduct.find(filter)
        // Manage Loans list only needs name/date/amount — keep the
        // payload light instead of shipping full documents.
        .select('name date loanAmount customerId')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum),
      LoanProduct.countDocuments(filter),
    ]);

    res.json({
      loans,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLoanById = async (req, res) => {
  try {
    const loan = await LoanProduct.findById(req.params.id);

    if (loan) {
      res.json({
        ...loan.toObject(),
        summary: getLoanSummary(loan),
      });
    } else {
      res.status(404).json({ message: 'Loan not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createLoan = async (req, res) => {
  try {
    const {
      name, address, customerId, mobileNo, description,
      goldWeight, silverWeight,
      date, dueDate, available, roi, returnDate, dissolveDate,
      loanAmount, signed, finalSettlement,
      reloans, payments,
    } = req.body;

    const loan = new LoanProduct({
      name,
      address,
      customerId,
      mobileNo,
      description,
      goldWeight,
      silverWeight,
      date,
      dueDate,
      available,
      roi,
      returnDate,
      dissolveDate,
      loanAmount,
      signed,
      finalSettlement,
      reloans: (reloans || []).map((r) => ({
        issueDate: r.issueDate,
        amount: r.amount,
      })),
      payments: (payments || []).map((p) => ({
        paidAmount: p.paidAmount,
        paidDate: p.paidDate,
      })),
    });

    const createdLoan = await loan.save();

    res.status(201).json({
      ...createdLoan.toObject(),
      summary: getLoanSummary(createdLoan),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateLoan = async (req, res) => {
  try {
    const {
      name, address, customerId, mobileNo, description,
      goldWeight, silverWeight,
      date, dueDate, available, roi, returnDate, dissolveDate,
      loanAmount, signed, finalSettlement,
      reloans, payments,
    } = req.body;

    const loan = await LoanProduct.findById(req.params.id);

    if (loan) {
      loan.name = name ?? loan.name;
      loan.address = address ?? loan.address;
      loan.customerId = customerId ?? loan.customerId;
      loan.mobileNo = mobileNo ?? loan.mobileNo;
      loan.description = description ?? loan.description;
      loan.goldWeight = goldWeight ?? loan.goldWeight;
      loan.silverWeight = silverWeight ?? loan.silverWeight;
      loan.date = date ?? loan.date;
      loan.dueDate = dueDate ?? loan.dueDate;
      loan.available = available ?? loan.available;
      loan.roi = roi ?? loan.roi;
      loan.returnDate = returnDate ?? loan.returnDate;
      loan.dissolveDate = dissolveDate ?? loan.dissolveDate;
      loan.loanAmount = loanAmount ?? loan.loanAmount;
      loan.signed = signed ?? loan.signed;
      loan.finalSettlement = finalSettlement ?? loan.finalSettlement;

      if (reloans) {
        loan.reloans = reloans.map((r) => ({
          issueDate: r.issueDate,
          amount: r.amount,
        }));
      }

      if (payments) {
        loan.payments = payments.map((p) => ({
          paidAmount: p.paidAmount,
          paidDate: p.paidDate,
        }));
      }

      // .save() runs the schema's validators (word counts, regex, enums, etc.)
      const updatedLoan = await loan.save();

      res.json({
        ...updatedLoan.toObject(),
        summary: getLoanSummary(updatedLoan),
      });
    } else {
      res.status(404).json({ message: 'Loan not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getLoanAnalytics = async (req, res) => {
  try {
    // Dashboard now only needs counts — the financial totals (loan
    // amount / interest / outstanding) moved to Manage Loans behind
    // a password check, see getLoanFinancials below.
    const [totalLoans, availableLoans, signedLoans] = await Promise.all([
      LoanProduct.countDocuments({}),
      LoanProduct.countDocuments({ available: 'yes' }),
      LoanProduct.countDocuments({ signed: 'yes' }),
    ]);

    res.json({ totalLoans, availableLoans, signedLoans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------------
// Re-verifies the logged-in admin's password before releasing the
// financial totals (loan amount / interest / outstanding). Being
// logged in as admin already gates this route (see routes file),
// but this adds an extra "confirm it's really you" step for the
// most sensitive numbers, similar to a banking app's re-auth prompt.
//
// NOTE: assumes your User model stores a bcrypt-hashed `password`
// field with `select: false`, and that `protect` middleware sets
// `req.user` from the JWT. Adjust the bcrypt.compare call below if
// your User model already exposes its own comparison method
// (e.g. `user.matchPassword(...)`) instead.
// -----------------------------------------------------------
const getLoanFinancials = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const admin = await User.findById(req.user._id).select('+password');

    if (!admin) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const loans = await LoanProduct.find({}).select(
      'loanAmount date roi reloans payments',
    );

    let totalLoanAmount = 0;
    let totalInterest = 0;
    let totalOutstanding = 0;

    loans.forEach((loan) => {
      const summary = getLoanSummary(loan);

      totalLoanAmount += summary.grandLoanAmount;
      totalInterest += summary.grandInterest;
      totalOutstanding += summary.finalAmount;
    });

    res.json({
      totalLoanAmount: Number(totalLoanAmount.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLoan = async (req, res) => {
  try {
    const loan = await LoanProduct.findById(req.params.id);

    if (loan) {
      await loan.deleteOne();
      res.json({ message: 'Loan removed' });
    } else {
      res.status(404).json({ message: 'Loan not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  getLoanAnalytics,
  getLoanFinancials,
};