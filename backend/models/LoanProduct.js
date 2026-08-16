const mongoose = require("mongoose");

const loanProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 60,
        message: "Name must be 60 words or fewer.",
      },
    },
    address: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 100,
        message: "Address must be 100 words or fewer.",
      },
    },
    goldWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    silverWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    customerId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [8, "Customer ID must be 8 characters or fewer."],
      match: [
        /^[A-Za-z0-9]{1,8}$/,
        "Customer ID must contain letters and numbers only (max 8).",
      ],
    },
    mobileNo: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Mobile No. must be exactly 10 digits."],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 300,
        message: "Description must be 300 words or fewer.",
      },
    },
    date: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    available: {
      type: String,
      enum: ["yes", "no"],
      default: "yes",
    },
    roi: {
      type: Number,
      default: 5,
      min: 0,
    },
    dissolveDate: {
      type: Date,
    },
    returnDate:{
      type : Date,
    },
    loanAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // interest / totalAmount are intentionally NOT stored — they are
    // date-dependent (grow every day the loan is unpaid), so storing
    // them would go stale. Always compute live via
    // utils/loanCalculations.getLoanSummary(loan) when reading a loan.

    signed: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    finalSettlement: {
      type: String,
      trim: true,
      validate: {
        validator: (v) =>
          !v || v.trim().split(/\s+/).filter(Boolean).length <= 100,
        message: "Final Settlement must be 100 words or fewer.",
      },
    },
    reloans: {
      type: [
        {
          issueDate: {
            type: Date,
            required: true,
          },
          amount: {
            type: Number,
            required: true,
            min: 0,
          },
          // No stored interest/totalAmount here either — same
          // reasoning as above, always derive via getLoanSummary().
        },
      ],
      validate: {
        validator: function (v) {
          return v.length <= 20;
        },
        message: "Maximum 20 re-loans are allowed.",
      },
    },
    payments: [
      {
        paidAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        paidDate: {
          type: Date,
          required: true,
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("LoanProduct", loanProductSchema);
