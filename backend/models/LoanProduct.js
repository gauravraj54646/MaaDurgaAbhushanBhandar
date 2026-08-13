const mongoose = require('mongoose');

const loanProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 60,
      message: 'Name must be 60 words or fewer.'
    }
  },
  address: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 100,
      message: 'Address must be 100 words or fewer.'
    }
  },
  customerId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: [8, 'Customer ID must be 8 letters or fewer.'],
    match: [/^[A-Za-z]{1,8}$/, 'Customer ID must contain letters only (max 8).']
  },
  mobileNo: {
    type: String,
    required: true,
    trim: true,
    match: [/^\d{10}$/, 'Mobile No. must be exactly 10 digits.']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 300,
      message: 'Description must be 300 words or fewer.'
    }
  },
  date: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  available: {
    type: String,
    enum: ['yes', 'no'],
    default: 'yes'
  },
  roi: {
    type: Number,
    default: 5,
    min: 0
  },
  dissolveDate: {
    type: Date
  },
  loanAmount: {
    type: Number,
    required: true,
    min: 0
  },
  interest: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  signed: {
    type: String,
    enum: ['yes', 'no'],
    default: 'no'
  },
  finalSettlement: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => !v || v.trim().split(/\s+/).filter(Boolean).length <= 100,
      message: 'Final Settlement must be 100 words or fewer.'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('LoanProduct', loanProductSchema);