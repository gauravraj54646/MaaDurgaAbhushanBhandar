const LoanProduct = require('../models/LoanProduct');

const getLoans = async (req, res) => {
  try {
    const loans = await LoanProduct.find({});
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLoanById = async (req, res) => {
  try {
    const loan = await LoanProduct.findById(req.params.id);
    if (loan) {
      res.json(loan);
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
      date, dueDate, available, roi, dissolveDate,
      loanAmount, interest, totalAmount, signed, finalSettlement
    } = req.body;

    const loan = new LoanProduct({
      name,
      address,
      customerId,
      mobileNo,
      description,
      date,
      dueDate,
      available,
      roi,
      dissolveDate,
      loanAmount,
      interest,
      totalAmount,
      signed,
      finalSettlement
    });

    const createdLoan = await loan.save();
    res.status(201).json(createdLoan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateLoan = async (req, res) => {
  try {
    const {
      name, address, customerId, mobileNo, description,
      date, dueDate, available, roi, dissolveDate,
      loanAmount, interest, totalAmount, signed, finalSettlement
    } = req.body;

    const loan = await LoanProduct.findById(req.params.id);
    if (loan) {
      loan.name = name ?? loan.name;
      loan.address = address ?? loan.address;
      loan.customerId = customerId ?? loan.customerId;
      loan.mobileNo = mobileNo ?? loan.mobileNo;
      loan.description = description ?? loan.description;
      loan.date = date ?? loan.date;
      loan.dueDate = dueDate ?? loan.dueDate;
      loan.available = available ?? loan.available;
      loan.roi = roi ?? loan.roi;
      loan.dissolveDate = dissolveDate ?? loan.dissolveDate;
      loan.loanAmount = loanAmount ?? loan.loanAmount;
      loan.interest = interest ?? loan.interest;
      loan.totalAmount = totalAmount ?? loan.totalAmount;
      loan.signed = signed ?? loan.signed;
      loan.finalSettlement = finalSettlement ?? loan.finalSettlement;

      // .save() runs the schema's validators (word counts, regex, enums, etc.)
      const updatedLoan = await loan.save();
      res.json(updatedLoan);
    } else {
      res.status(404).json({ message: 'Loan not found' });
    }
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

module.exports = { getLoans, getLoanById, createLoan, updateLoan, deleteLoan };