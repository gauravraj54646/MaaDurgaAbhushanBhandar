const mongoose = require("mongoose");

/* ---------- Sub-schema: one line item on the bill ---------- */
const billItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["gold", "silver", "diamond", "platinum", "other"],
      required: true,
    },
    huid: {
      // BIS Hallmark Unique ID (required for gold jewelry sales in India)
      type: String,
      trim: true,
      uppercase: true,
    },
    purity: {
      // e.g. "22K", "916", "999", "925"
      type: String,
      trim: true,
    },
    hsnCode: {
      type: String,
      trim: true,
    },
    grossWeight: {
      // total weight including stones (grams)
      type: Number,
      required: true,
      min: 0,
    },
    stoneWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    netWeight: {
      // grossWeight - stoneWeight, used for metal rate calc
      type: Number,
      required: true,
      min: 0,
    },
    ratePerGram: {
      type: Number,
      required: true,
      min: 0,
    },
    makingChargeType: {
      type: String,
      enum: ["flat", "perGram", "percentage"],
      default: "perGram",
    },
    makingCharge: {
      // value interpreted per makingChargeType
      type: Number,
      default: 0,
      min: 0,
    },
    wastagePercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    stoneCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    amount: {
      // final computed amount for this line (see pre-save hook below)
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

/* ---------- Sub-schema: old gold/silver taken in exchange ---------- */
const exchangeItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["gold", "silver"],
      required: true,
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    purity: {
      type: String,
      trim: true,
    },
    deduction: {
      // impurity/wastage deduction, in grams
      type: Number,
      default: 0,
      min: 0,
    },
    netWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    ratePerGram: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const billSchema = new mongoose.Schema(
  {
    billNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [15, "Bill No. must be 15 characters or fewer."],
    },
    billDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // ----- Customer -----
    customerName: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => v.trim().split(/\s+/).filter(Boolean).length <= 60,
        message: "Customer name must be 60 words or fewer.",
      },
    },
    mobileNo: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Mobile No. must be exactly 10 digits."],
    },
    address: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || v.trim().split(/\s+/).filter(Boolean).length <= 100,
        message: "Address must be 100 words or fewer.",
      },
    },
    gstin: {
      // customer's GSTIN, only needed for B2B bills
      type: String,
      trim: true,
      uppercase: true,
    },

    // ----- Items purchased -----
    items: {
      type: [billItemSchema],
      required: true,
      validate: {
        validator: (v) => v.length > 0 && v.length <= 100,
        message: "Bill must have between 1 and 100 items.",
      },
    },

    // ----- Old gold/silver exchange (optional trade-in) -----
    exchangeItems: {
      type: [exchangeItemSchema],
      default: [],
    },

    // ----- Charges & totals -----
    itemsSubtotal: {
      // sum of items[].amount, before discount/tax
      type: Number,
      default: 0,
      min: 0,
    },
    exchangeTotal: {
      // sum of exchangeItems[].amount, subtracted from payable
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cgstPercent: {
      type: Number,
      default: 1.5,
      min: 0,
    },
    sgstPercent: {
      type: Number,
      default: 1.5,
      min: 0,
    },
    cgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      // final payable amount after tax, discount, exchange adjustment
      type: Number,
      default: 0,
      min: 0,
    },

    // ----- Payment -----
    paymentMode: {
      type: String,
      enum: ["cash", "card", "upi", "cheque", "bank_transfer", "mixed"],
      default: "cash",
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "pending"],
      default: "paid",
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ----- Misc -----
    soldBy: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || v.trim().split(/\s+/).filter(Boolean).length <= 300,
        message: "Notes must be 300 words or fewer.",
      },
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

/* ---------- Auto-calculate line amounts & bill totals ---------- */
// Synchronous middleware (Mongoose 7+ no longer supports the
// function(next) callback style — declaring `next` as a param means
// Mongoose won't pass a real callback, so calling next() throws
// "next is not a function". A plain sync function works instead.
billSchema.pre("validate", function () {
  // 1. compute each item's amount
  this.items.forEach((item) => {
    const metalValue = item.netWeight * item.ratePerGram;
    const wastageValue = metalValue * (item.wastagePercent / 100);

    let makingValue = 0;
    if (item.makingChargeType === "flat") makingValue = item.makingCharge;
    else if (item.makingChargeType === "perGram")
      makingValue = item.makingCharge * item.netWeight;
    else if (item.makingChargeType === "percentage")
      makingValue = metalValue * (item.makingCharge / 100);

    const lineTotal =
      (metalValue + wastageValue + makingValue + item.stoneCharge) *
      item.quantity;

    item.amount = Math.round(lineTotal * 100) / 100;
  });

  // 2. compute exchange item amounts
  this.exchangeItems.forEach((ex) => {
    ex.amount = Math.round(ex.netWeight * ex.ratePerGram * 100) / 100;
  });

  // 3. roll up totals
  this.itemsSubtotal = this.items.reduce((sum, i) => sum + i.amount, 0);
  this.exchangeTotal = this.exchangeItems.reduce((sum, e) => sum + e.amount, 0);

  this.taxableAmount = Math.max(this.itemsSubtotal - this.discount, 0);
  this.cgstAmount = Math.round(this.taxableAmount * (this.cgstPercent / 100) * 100) / 100;
  this.sgstAmount = Math.round(this.taxableAmount * (this.sgstPercent / 100) * 100) / 100;

  const preRound =
    this.taxableAmount + this.cgstAmount + this.sgstAmount - this.exchangeTotal;
  const rounded = Math.round(preRound);
  this.roundOff = Math.round((rounded - preRound) * 100) / 100;
  this.grandTotal = Math.max(rounded, 0);

  this.balanceDue = Math.max(this.grandTotal - this.amountPaid, 0);
  this.paymentStatus =
    this.balanceDue === 0 ? "paid" : this.amountPaid === 0 ? "pending" : "partial";
});

module.exports = mongoose.model("Bill", billSchema);