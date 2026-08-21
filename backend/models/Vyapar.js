const mongoose = require("mongoose");

/**
 * One dated fine-weight settlement against an item. Gold/silver rate
 * changes every day, so each entry freezes the rate that applied on
 * its own date — amount is derived from fineWeight * rate at that
 * point in time, never recomputed later even if the rate moves.
 */
const finePaymentSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    rate: {
      // gold/silver rate on this date (per gram or per 10g — pick one
      // convention and use it everywhere)
      type: Number,
      required: true,
      min: 0,
    },
    fineWeight: {
      // how much of the item's net weight is being settled/paid off
      // on this date
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      // derived: fineWeight * rate — recomputed in pre-validate below,
      // frozen at save time since the rate on this date won't change
      type: Number,
      min: 0,
    },
  },
  { _id: true },
);

finePaymentSchema.pre("validate", function (next) {
  this.amount = +(this.fineWeight * this.rate).toFixed(2);
  next();
});

/**
 * One pledged item (a gold or silver piece).
 * netWeight is ALWAYS derived from grossWeight * (tunch/100) — it is
 * recomputed in the pre-validate hook below so it can never drift out
 * of sync with grossWeight/tunch, even if someone edits one of them.
 *
 * finePayments is the dated ledger of weight settled off this item;
 * remainingWeight (virtual, below) is netWeight minus whatever's
 * already been paid off.
 */
const itemSchema = new mongoose.Schema(
  {
    metal: {
      type: String,
      enum: ["gold", "silver"],
      required: true,
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    tunch: {
      // purity, as a percentage (0–100)
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    netWeight: {
      // derived: grossWeight * (tunch / 100) — do not set manually
      type: Number,
      min: 0,
    },
    labour: {
      // making charges, flat amount
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      validate: {
        validator: (v) =>
          !v || v.trim().split(/\s+/).filter(Boolean).length <= 50,
        message: "Item description must be 50 words or fewer.",
      },
    },
    finePayments: {
      type: [finePaymentSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 100,
        message: "Maximum 100 fine-payment entries per item.",
      },
    },
  },
  { _id: true },
);

itemSchema.pre("validate", function (next) {
  this.netWeight = +(this.grossWeight * (this.tunch / 100)).toFixed(3);

  const totalPaid = this.finePayments.reduce(
    (sum, p) => sum + (p.fineWeight || 0),
    0,
  );
  // small epsilon for floating-point rounding
  if (totalPaid > this.netWeight + 0.001) {
    return next(
      new Error(
        `Total fine weight paid (${totalPaid}) exceeds item's net weight (${this.netWeight}).`,
      ),
    );
  }
  next();
});

// How much of this item's weight is still outstanding after
// subtracting every dated fine-payment entry.
itemSchema.virtual("remainingWeight").get(function () {
  const totalPaid = this.finePayments.reduce(
    (sum, p) => sum + (p.fineWeight || 0),
    0,
  );
  return +(this.netWeight - totalPaid).toFixed(3);
});

// True once the item's full net weight has been paid off / sold.
itemSchema.virtual("isSettled").get(function () {
  return this.remainingWeight <= 0.001;
});

itemSchema.set("toObject", { virtuals: true });
itemSchema.set("toJSON", { virtuals: true });

const vyaparSchema = new mongoose.Schema(
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

    // Replaces the old flat goldWeight/silverWeight numbers.
    // Each entry is one physical item pledged, with its own
    // gross weight, tunch, derived net weight, labour and description.
    items: {
      type: [itemSchema],
      validate: [
        {
          validator: (v) => v.length > 0,
          message: "At least one item (gold/silver) is required.",
        },
        {
          validator: (v) => v.length <= 50,
          message: "Maximum 50 items are allowed.",
        },
      ],
    },

    // Links this pledge/customer record to the loan you maintain in
    // your separate Loan model. Swap `ref: "Loan"` for whatever you
    // actually named that model if it differs.
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },

    customerId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Convenience virtuals so any code still expecting a single "total
// gold weight" / "total silver weight" number keeps working, without
// storing a value that could drift from the items array.
vyaparSchema.virtual("totalGoldNetWeight").get(function () {
  return this.items
    .filter((i) => i.metal === "gold")
    .reduce((sum, i) => sum + (i.netWeight || 0), 0);
});

vyaparSchema.virtual("totalSilverNetWeight").get(function () {
  return this.items
    .filter((i) => i.metal === "silver")
    .reduce((sum, i) => sum + (i.netWeight || 0), 0);
});

// Same totals, but after subtracting each item's dated fine-payments —
// i.e. what's actually still outstanding today.
vyaparSchema.virtual("totalGoldRemainingWeight").get(function () {
  return this.items
    .filter((i) => i.metal === "gold")
    .reduce((sum, i) => sum + (i.remainingWeight || 0), 0);
});

vyaparSchema.virtual("totalSilverRemainingWeight").get(function () {
  return this.items
    .filter((i) => i.metal === "silver")
    .reduce((sum, i) => sum + (i.remainingWeight || 0), 0);
});

vyaparSchema.set("toObject", { virtuals: true });
vyaparSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Vyapar", vyaparSchema);