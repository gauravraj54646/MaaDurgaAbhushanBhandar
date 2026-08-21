const asyncHandler = require("express-async-handler");
const Person = require("../models/Person");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const PHONE_REGEX = /^\d{10}$/;

const VALID_GENDERS = [
  "male",
  "female",
  "other",
  "prefer_not_to_say",
];

const VALID_STATUSES = [
  "active",
  "inactive",
  "archived",
];

// ============================================================
// Helper: Validate + normalize incoming person fields
// ============================================================

const sanitizePersonInput = (body, res) => {
  const {
    customerId,
    name,
    email,
    phone,
    address,
    hasLoan,
    loanIds,
    hasBill,
    billNumbers,
    dateOfBirth,
    gender,
    extraInfo,
    status,
    source,
    tags,
  } = body;

  // -----------------------------
  // EMAIL
  // -----------------------------

  if (
    email !== undefined &&
    email !== null &&
    email !== ""
  ) {
    const trimmedEmail = String(email)
      .trim()
      .toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      res.status(400);
      throw new Error("Please provide a valid email address");
    }
  }

  // -----------------------------
  // PHONE
  // -----------------------------

  if (
    phone !== undefined &&
    phone !== null &&
    phone !== ""
  ) {
    const trimmedPhone = String(phone).trim();

    if (!PHONE_REGEX.test(trimmedPhone)) {
      res.status(400);
      throw new Error(
        "Phone number must be exactly 10 digits"
      );
    }
  }

  // -----------------------------
  // GENDER
  // -----------------------------

  if (
    gender !== undefined &&
    gender !== null &&
    !VALID_GENDERS.includes(gender)
  ) {
    res.status(400);

    throw new Error(
      `Gender must be one of: ${VALID_GENDERS.join(", ")}`
    );
  }

  // -----------------------------
  // STATUS
  // -----------------------------

  if (
    status !== undefined &&
    status !== null &&
    !VALID_STATUSES.includes(status)
  ) {
    res.status(400);

    throw new Error(
      `Status must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }

  // -----------------------------
  // TAGS
  // -----------------------------

  let normalizedTags;

  if (tags !== undefined) {
    if (Array.isArray(tags)) {
      normalizedTags = tags
        .map((tag) => String(tag).trim())
        .filter(Boolean);
    } else if (typeof tags === "string") {
      normalizedTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else {
      normalizedTags = [];
    }
  }

  // -----------------------------
  // LOAN IDS
  // -----------------------------

  let normalizedLoanIds;

  if (loanIds !== undefined) {
    if (Array.isArray(loanIds)) {
      normalizedLoanIds = loanIds
        .map((id) => String(id).trim().toUpperCase())
        .filter(Boolean);
    } else if (typeof loanIds === "string") {
      normalizedLoanIds = loanIds
        .split(",")
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean);
    } else {
      normalizedLoanIds = [];
    }
  }

  // -----------------------------
  // BILL NUMBERS
  // -----------------------------

  let normalizedBillNumbers;

  if (billNumbers !== undefined) {
    if (Array.isArray(billNumbers)) {
      normalizedBillNumbers = billNumbers
        .map((num) => String(num).trim().toUpperCase())
        .filter(Boolean);
    } else if (typeof billNumbers === "string") {
      normalizedBillNumbers = billNumbers
        .split(",")
        .map((num) => num.trim().toUpperCase())
        .filter(Boolean);
    } else {
      normalizedBillNumbers = [];
    }
  }

  // -----------------------------
  // RETURN CLEAN DATA
  // -----------------------------

  return {
    customerId:
      customerId !== undefined
        ? String(customerId).trim() || undefined
        : undefined,

    name:
      name !== undefined
        ? String(name).trim()
        : undefined,

    email:
      email !== undefined
        ? email
          ? String(email).trim().toLowerCase()
          : null
        : undefined,

    phone:
      phone !== undefined
        ? phone
          ? String(phone).trim()
          : null
        : undefined,

    address:
      address !== undefined
        ? address
          ? String(address).trim()
          : null
        : undefined,

    // -----------------------------
    // LOAN
    // -----------------------------

    loanIds: normalizedLoanIds,

    hasLoan:
      normalizedLoanIds !== undefined
        ? normalizedLoanIds.length > 0
        : hasLoan !== undefined
          ? Boolean(hasLoan)
          : undefined,

    // -----------------------------
    // BILL
    // -----------------------------

    billNumbers: normalizedBillNumbers,

    hasBill:
      normalizedBillNumbers !== undefined
        ? normalizedBillNumbers.length > 0
        : hasBill !== undefined
          ? Boolean(hasBill)
          : undefined,

    // -----------------------------
    // OTHER FIELDS
    // -----------------------------

    dateOfBirth:
      dateOfBirth !== undefined
        ? dateOfBirth || null
        : undefined,

    gender,

    extraInfo:
      extraInfo !== undefined
        ? extraInfo
          ? String(extraInfo).trim()
          : null
        : undefined,

    status,

    source:
      source !== undefined
        ? source
          ? String(source).trim()
          : null
        : undefined,

    tags: normalizedTags,
  };
};

// ============================================================
// GET ALL PEOPLE
// Pagination + Server-side Search
// ============================================================

// @desc    Get people with pagination and search
// @route   GET /api/people
// @access  Private/Admin

const getPeople = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    search = "",
    status = "",
  } = req.query;

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const pageNum = Math.max(
    1,
    parseInt(page, 10) || 1
  );

  const limitNum = Math.max(
    1,
    Math.min(
      100,
      parseInt(limit, 10) || 50
    )
  );

  const skip = (pageNum - 1) * limitNum;

  // ==========================================================
  // FILTER
  // ==========================================================

  const filter = {};

  // ==========================================================
  // SEARCH
  // Name
  // Customer ID
  // Phone
  // Email
  // ==========================================================

  if (
    typeof search === "string" &&
    search.trim()
  ) {
    const searchText = search.trim();

    // Escape regex special characters
    const escapedSearch =
      searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    filter.$or = [
      {
        name: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        customerId: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        phone: {
          $regex: escapedSearch,
          $options: "i",
        },
      },

      {
        email: {
          $regex: escapedSearch,
          $options: "i",
        },
      },
    ];
  }

  // ==========================================================
  // STATUS FILTER
  // ==========================================================

  if (
    status &&
    VALID_STATUSES.includes(status)
  ) {
    filter.status = status;
  }

  // ==========================================================
  // DATABASE QUERY
  // ==========================================================

  const [people, total] = await Promise.all([
    Person.find(filter)
      .populate(
        "createdBy",
        "name email"
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNum)
      .lean(),

    Person.countDocuments(filter),
  ]);

  // ==========================================================
  // PAGINATION INFO
  // ==========================================================

  const totalPages =
    Math.ceil(total / limitNum);

  // ==========================================================
  // RESPONSE
  // ==========================================================

  res.status(200).json({
    people,

    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,

      hasNextPage:
        pageNum < totalPages,

      hasPrevPage:
        pageNum > 1,
    },
  });
});

// ============================================================
// GET PERSON BY ID
// ============================================================

// @desc    Get person by ID
// @route   GET /api/people/:id
// @access  Private/Admin

const getPersonById = asyncHandler(
  async (req, res) => {
    const person =
      await Person.findById(
        req.params.id
      ).populate(
        "createdBy",
        "name email"
      );

    if (!person) {
      res.status(404);

      throw new Error(
        "Person not found"
      );
    }

    res.status(200).json(person);
  }
);

// ============================================================
// CREATE PERSON
// ============================================================

// @desc    Create a new person
// @route   POST /api/people
// @access  Private/Admin

const createPerson = asyncHandler(
  async (req, res) => {
    // Name required
    if (
      !req.body.name ||
      !String(req.body.name).trim()
    ) {
      res.status(400);

      throw new Error(
        "Name is required"
      );
    }

    const clean =
      sanitizePersonInput(
        req.body,
        res
      );

    const person =
      await Person.create({
        ...clean,
        createdBy:
          req.user._id,
      });

    res
      .status(201)
      .json(person);
  }
);

// ============================================================
// UPDATE PERSON
// ============================================================

// @desc    Update a person
// @route   PUT /api/people/:id
// @access  Private/Admin

const updatePerson = asyncHandler(
  async (req, res) => {
    const person =
      await Person.findById(
        req.params.id
      );

    if (!person) {
      res.status(404);

      throw new Error(
        "Person not found"
      );
    }

    const clean =
      sanitizePersonInput(
        req.body,
        res
      );

    // -----------------------------
    // Customer ID
    // -----------------------------

    if (
      clean.customerId !== undefined
    ) {
      person.customerId =
        clean.customerId;
    }

    // -----------------------------
    // Name
    // -----------------------------

    if (
      clean.name !== undefined
    ) {
      if (!clean.name) {
        res.status(400);

        throw new Error(
          "Name cannot be empty"
        );
      }

      person.name =
        clean.name;
    }

    // -----------------------------
    // Email
    // -----------------------------

    if (
      clean.email !== undefined
    ) {
      person.email =
        clean.email;
    }

    // -----------------------------
    // Phone
    // -----------------------------

    if (
      clean.phone !== undefined
    ) {
      person.phone =
        clean.phone;
    }

    // -----------------------------
    // Address
    // -----------------------------

    if (
      clean.address !== undefined
    ) {
      person.address =
        clean.address;
    }

    // -----------------------------
    // LOAN IDS
    // -----------------------------

    if (
      clean.loanIds !== undefined
    ) {
      person.loanIds =
        clean.loanIds;
    }

    if (
      clean.hasLoan !== undefined
    ) {
      person.hasLoan =
        clean.hasLoan;
    }

    // -----------------------------
    // BILL NUMBERS
    // -----------------------------

    if (
      clean.billNumbers !== undefined
    ) {
      person.billNumbers =
        clean.billNumbers;
    }

    if (
      clean.hasBill !== undefined
    ) {
      person.hasBill =
        clean.hasBill;
    }

    // -----------------------------
    // DOB
    // -----------------------------

    if (
      clean.dateOfBirth !== undefined
    ) {
      person.dateOfBirth =
        clean.dateOfBirth;
    }

    // -----------------------------
    // Gender
    // -----------------------------

    if (
      clean.gender !== undefined
    ) {
      person.gender =
        clean.gender;
    }

    // -----------------------------
    // Extra Info
    // -----------------------------

    if (
      clean.extraInfo !== undefined
    ) {
      person.extraInfo =
        clean.extraInfo;
    }

    // -----------------------------
    // Status
    // -----------------------------

    if (
      clean.status !== undefined
    ) {
      person.status =
        clean.status;
    }

    // -----------------------------
    // Source
    // -----------------------------

    if (
      clean.source !== undefined
    ) {
      person.source =
        clean.source;
    }

    // -----------------------------
    // Tags
    // -----------------------------

    if (
      clean.tags !== undefined
    ) {
      person.tags =
        clean.tags;
    }

    // -----------------------------
    // SAVE
    // -----------------------------

    const updatedPerson =
      await person.save();

    res
      .status(200)
      .json(updatedPerson);
  }
);

// ============================================================
// DELETE PERSON
// ============================================================

/// ============================================================
// DELETE PERSON
// ============================================================

// @desc    Delete a person
// @route   DELETE /api/people/:id
// @access  Private/Admin

const deletePerson = asyncHandler(async (req, res) => {
  try {
    const { adminPassword } = req.body;

    // ==========================================================
    // 1. ADMIN PASSWORD REQUIRED
    // ==========================================================

    if (
      typeof adminPassword !== "string" ||
      !adminPassword.trim()
    ) {
      return res.status(400).json({
        message: "Admin password is required",
      });
    }

    // ==========================================================
    // 2. GET CURRENT LOGGED-IN USER
    // ==========================================================

    const adminUser = await User.findById(req.user._id).select(
      "+password"
    );

    if (!adminUser) {
      return res.status(401).json({
        message: "Admin account not found",
      });
    }

    // ==========================================================
    // 3. CHECK ADMIN ROLE
    // ==========================================================

    if (adminUser.role !== "admin") {
      return res.status(403).json({
        message: "Only an admin can delete a person",
      });
    }

    // ==========================================================
    // 4. VERIFY ADMIN PASSWORD
    // ==========================================================

    const passwordMatches = await bcrypt.compare(
      adminPassword,
      adminUser.password
    );

    if (!passwordMatches) {
      return res.status(403).json({
        message: "Incorrect Admin password",
      });
    }

    // ==========================================================
    // 5. FIND PERSON
    // ==========================================================

    const person = await Person.findById(req.params.id);

    if (!person) {
      return res.status(404).json({
        message: "Person not found",
      });
    }

    // ==========================================================
    // 6. DELETE PERSON
    // ==========================================================

    await person.deleteOne();

    // ==========================================================
    // 7. RESPONSE
    // ==========================================================

    res.json({
      message: "Person deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});
// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getPeople,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
};