const asyncHandler = require('express-async-handler');

const Person = require('../models/Person');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;
const VALID_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];
const VALID_STATUSES = ['active', 'inactive', 'archived'];

// ============================================================
// Helper: validate + normalize incoming person fields
// FIX: the frontend was the only thing sanitizing/validating
// email, phone, gender, status. The server must never trust
// the client for this.
// ============================================================

const sanitizePersonInput = (body, res) => {
  const {
    customerId,
    name,
    email,
    phone,
    address,
    dateOfBirth,
    gender,
    preferences,
    status,
    source,
    tags,
  } = body;

  if (email !== undefined && email !== null && email !== '') {
    const trimmedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    const trimmedPhone = String(phone).trim();
    if (!PHONE_REGEX.test(trimmedPhone)) {
      res.status(400);
      throw new Error('Phone number must be exactly 10 digits');
    }
  }

  if (gender !== undefined && gender !== null && !VALID_GENDERS.includes(gender)) {
    res.status(400);
    throw new Error(`Gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
    res.status(400);
    throw new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  return {
    customerId: customerId !== undefined ? String(customerId).trim() || undefined : undefined,
    name: name !== undefined ? String(name).trim() : undefined,
    email: email !== undefined ? (email ? String(email).trim().toLowerCase() : null) : undefined,
    phone: phone !== undefined ? (phone ? String(phone).trim() : null) : undefined,
    address: address !== undefined ? (address ? String(address).trim() : null) : undefined,
    dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth || null) : undefined,
    gender,
    preferences: preferences !== undefined ? (preferences ? String(preferences).trim() : null) : undefined,
    status,
    source: source !== undefined ? (source ? String(source).trim() : null) : undefined,
    tags,
  };
};

// @desc    Get all people
// @route   GET /api/people
// @access  Private/Admin
// @desc    Get people with pagination + search
// @route   GET /api/people
// @access  Private/Admin
const getPeople = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    search = "",
    status = "",
  } = req.query;

  // -----------------------------
  // SAFE PAGINATION
  // -----------------------------
  const pageNum = Math.max(
    1,
    parseInt(page, 10) || 1
  );

  const limitNum = Math.max(
    1,
    Math.min(100, parseInt(limit, 10) || 50)
  );

  const skip = (pageNum - 1) * limitNum;

  // -----------------------------
  // FILTER
  // -----------------------------
  const filter = {};

  // Search by:
  // Name
  // Customer ID
  // Phone
  // Email
  if (search && search.trim()) {
    const searchText = search.trim();

    // Escape regex special characters
    const escapedSearch = searchText.replace(
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

  // Optional status filter
  if (
    status &&
    VALID_STATUSES.includes(status)
  ) {
    filter.status = status;
  }

  // -----------------------------
  // QUERY
  // -----------------------------
  const [people, total] = await Promise.all([
    Person.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),

    Person.countDocuments(filter),
  ]);

  // -----------------------------
  // RESPONSE
  // -----------------------------
  res.status(200).json({
    people,

    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNextPage:
        pageNum < Math.ceil(total / limitNum),
      hasPrevPage: pageNum > 1,
    },
  });
});
// @desc    Get person by ID
// @route   GET /api/people/:id
// @access  Private/Admin
const getPersonById = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.params.id)
    .populate('createdBy', 'name email');

  if (!person) {
    res.status(404);
    throw new Error('Person not found');
  }

  res.status(200).json(person);
});

// @desc    Create a new person
// @route   POST /api/people
// @access  Private/Admin
const createPerson = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    res.status(400);
    throw new Error('Name is required');
  }

  const clean = sanitizePersonInput(req.body, res);

  const person = await Person.create({
    ...clean,
    createdBy: req.user._id,
  });

  res.status(201).json(person);
});

// @desc    Update a person
// @route   PUT /api/people/:id
// @access  Private/Admin
const updatePerson = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.params.id);

  if (!person) {
    res.status(404);
    throw new Error('Person not found');
  }

  const clean = sanitizePersonInput(req.body, res);

  if (clean.customerId !== undefined) {
    person.customerId = clean.customerId;
  }

  if (clean.name !== undefined) {
    if (!clean.name) {
      res.status(400);
      throw new Error('Name cannot be empty');
    }
    person.name = clean.name;
  }

  if (clean.email !== undefined) {
    person.email = clean.email;
  }

  if (clean.phone !== undefined) {
    person.phone = clean.phone;
  }

  if (clean.address !== undefined) {
    person.address = clean.address;
  }

  if (clean.dateOfBirth !== undefined) {
    person.dateOfBirth = clean.dateOfBirth;
  }

  if (clean.gender !== undefined) {
    person.gender = clean.gender;
  }

  if (clean.preferences !== undefined) {
    person.preferences = clean.preferences;
  }

  if (clean.status !== undefined) {
    person.status = clean.status;
  }

  if (clean.source !== undefined) {
    person.source = clean.source;
  }

  if (clean.tags !== undefined) {
    person.tags = clean.tags;
  }

  const updatedPerson = await person.save();

  res.status(200).json(updatedPerson);
});

// @desc    Delete a person
// @route   DELETE /api/people/:id
// @access  Private/Admin
const deletePerson = asyncHandler(async (req, res) => {
  const person = await Person.findById(req.params.id);

  if (!person) {
    res.status(404);
    throw new Error('Person not found');
  }

  await person.deleteOne();

  res.status(200).json({
    message: 'Person deleted successfully',
  });
});

module.exports = {
  getPeople,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
};