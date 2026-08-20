const mongoose = require("mongoose");

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;

const personSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      unique: true,
      sparse: true, // FIX: without this, the 2nd person with no customerId
      // throws a duplicate-key error because Mongo's unique index
      // treats multiple `undefined` values as duplicates of `null`.
      index: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      validate: {
        validator: function (value) {
          if (!value) return true; // optional field
          return EMAIL_REGEX.test(value);
        },
        message: "Please provide a valid email address",
      },
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (value) {
          if (!value) return true; // optional field
          return PHONE_REGEX.test(value);
        },
        message: "Phone number must be exactly 10 digits",
      },
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    preferences: {
      type: String,
      trim: true,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },

    source: {
      type: String,
      trim: true,
      default: null,
    },

    tags: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Person", personSchema);