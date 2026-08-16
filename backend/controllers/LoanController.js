const LoanProduct = require("../models/LoanProduct");
const { getLoanSummary } = require("../utils/loanCalculations");

const getLoans = async (req, res) => {
  try {
    const loans = await LoanProduct.find({});

    const withSummaries = loans.map((loan) => ({
      ...loan.toObject(),
      summary: getLoanSummary(loan),
    }));

    res.json(withSummaries);
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
      res.status(404).json({ message: "Loan not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createLoan = async (req, res) => {
  try {
    const {
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
      dissolveDate,
      loanAmount,
      signed,
      finalSettlement,
      reloans,
      payments,
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
      dissolveDate,
      loanAmount,
      signed,
      finalSettlement,
      reloans,
      payments,
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
      res.status(404).json({ message: "Loan not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteLoan = async (req, res) => {
  try {
    const loan = await LoanProduct.findById(req.params.id);

    if (loan) {
      await loan.deleteOne();
      res.json({ message: "Loan removed" });
    } else {
      res.status(404).json({ message: "Loan not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLoans, getLoanById, createLoan, updateLoan, deleteLoan };
