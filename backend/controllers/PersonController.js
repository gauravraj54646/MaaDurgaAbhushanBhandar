const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;

const Person = require("../models/Person");
const User = require("../models/User");
const Bill = require("../models/Bill");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\d{10}$/;
const CUSTOMER_ID_REGEX = /^[A-Z0-9]{1,8}$/;

const VALID_GENDERS = ["male", "female", "other", "prefer_not_to_say"];
const VALID_STATUSES = ["active", "inactive", "archived"];

// The People form uploads through BillPhotoUpload, so photos live in the
// "bills/" folder. "people/" is allowed too in case you add a separate
// upload folder later.
const ALLOWED_PHOTO_FOLDERS = ["bills/", "people/"];

// ============================================================
// Helpers
// ============================================================

const fail = (res, code, message) => {
  res.status(code);
  throw new Error(message);
};

const requireValidId = (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    fail(res, 400, "Invalid person ID");
  }
};

// Accepts only a well-formed photo that lives in our Cloudinary account.
const cleanPhoto = (photo) => {
  if (
    !photo ||
    typeof photo.url !== "string" ||
    typeof photo.publicId !== "string" ||
    !ALLOWED_PHOTO_FOLDERS.some((folder) => photo.publicId.startsWith(folder)) ||
    !photo.url.startsWith(
      `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`
    )
  ) {
    return null;
  }
  return { url: photo.url, publicId: photo.publicId };
};

// Deletes the image only if no bill or person still uses it. A person's
// photo can be copied onto a bill as the customer photo, so both can point
// to the same Cloudinary image. Best-effort: never breaks the request.
const deletePhotoIfUnused = async (publicId) => {
  if (!publicId) return;
  try {
    const [usedByBill, usedByPerson] = await Promise.all([
      Bill.exists({
        $or: [
          { "photo.publicId": publicId },
          { "customerPhoto.publicId": publicId },
        ],
      }),
      Person.exists({ "photo.publicId": publicId }),
    ]);

    if (usedByBill || usedByPerson) return;

    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary cleanup failed:", err.message);
  }
};

// Accepts an array or a comma-separated string -> clean string array
const normalizeList = (value, upper = false) => {
  if (value === undefined) return undefined;

  let items = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === "string") items = value.split(",");

  return items
    .map((item) => {
      const s = String(item).trim();
      return upper ? s.toUpperCase() : s;
    })
    .filter(Boolean);
};

// Turns a Mongo duplicate-key error into a clean 409
const rethrowDuplicate = (err, res) => {
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const label =
      field === "customerId"
        ? "Customer ID"
        : field
        ? field.charAt(0).toUpperCase() + field.slice(1)
        : "Value";
    res.status(409);
    throw new Error(`${label} already exists`);
  }
  throw err;
};

// ============================================================
// Validate + normalize incoming person fields
//
// photo in the returned object:
//   undefined -> not sent, leave as is
//   null      -> user removed it
//   {url,...} -> new or unchanged photo
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
    photo,
  } = body;

  // EMAIL
  if (email !== undefined && email !== null && email !== "") {
    if (!EMAIL_REGEX.test(String(email).trim().toLowerCase())) {
      fail(res, 400, "Please provide a valid email address");
    }
  }

  // PHONE
  if (phone !== undefined && phone !== null && phone !== "") {
    if (!PHONE_REGEX.test(String(phone).trim())) {
      fail(res, 400, "Phone number must be exactly 10 digits");
    }
  }

  // CUSTOMER ID (uppercase + validate)
  let normalizedCustomerId;
  if (customerId !== undefined && customerId !== null) {
    const id = String(customerId).trim().toUpperCase();
    if (id) {
      if (!CUSTOMER_ID_REGEX.test(id)) {
        fail(
          res,
          400,
          "Customer ID must contain only letters and numbers, maximum 8 characters"
        );
      }
      normalizedCustomerId = id;
    }
  }

  // GENDER (null / "" treated as "not provided")
  const normalizedGender = gender === null || gender === "" ? undefined : gender;

  if (
    normalizedGender !== undefined &&
    !VALID_GENDERS.includes(normalizedGender)
  ) {
    fail(res, 400, `Gender must be one of: ${VALID_GENDERS.join(", ")}`);
  }

  // STATUS
  if (status !== undefined && status !== null && !VALID_STATUSES.includes(status)) {
    fail(res, 400, `Status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  // DATE OF BIRTH
  let normalizedDob;
  if (dateOfBirth !== undefined) {
    if (!dateOfBirth) {
      normalizedDob = null;
    } else {
      const d = new Date(dateOfBirth);
      if (Number.isNaN(d.getTime())) {
        fail(res, 400, "Date of birth is not a valid date");
      }
      if (d.getTime() > Date.now()) {
        fail(res, 400, "Date of birth cannot be in the future");
      }
      normalizedDob = d;
    }
  }

  // PHOTO
  let normalizedPhoto;
  if (photo !== undefined) {
    if (photo === null) {
      normalizedPhoto = null;
    } else {
      normalizedPhoto = cleanPhoto(photo);
      if (!normalizedPhoto) {
        fail(res, 400, "Invalid photo data.");
      }
    }
  }

  const normalizedLoanIds = normalizeList(loanIds, true);
  const normalizedBillNumbers = normalizeList(billNumbers, true);

  const optionalString = (value) =>
    value !== undefined ? (value ? String(value).trim() : null) : undefined;

  return {
    customerId: normalizedCustomerId,
    name: name !== undefined ? String(name).trim() : undefined,
    email:
      email !== undefined
        ? email
          ? String(email).trim().toLowerCase()
          : null
        : undefined,
    phone: optionalString(phone),
    address: optionalString(address),

    loanIds: normalizedLoanIds,
    hasLoan:
      normalizedLoanIds !== undefined
        ? normalizedLoanIds.length > 0
        : hasLoan !== undefined
        ? Boolean(hasLoan)
        : undefined,

    billNumbers: normalizedBillNumbers,
    hasBill:
      normalizedBillNumbers !== undefined
        ? normalizedBillNumbers.length > 0
        : hasBill !== undefined
        ? Boolean(hasBill)
        : undefined,

    dateOfBirth: normalizedDob,
    gender: normalizedGender,
    extraInfo: optionalString(extraInfo),
    status: status === null ? undefined : status,
    source: optionalString(source),
    tags: normalizeList(tags),
    photo: normalizedPhoto,
  };
};

// ============================================================
// GET ALL PEOPLE
// @route GET /api/people?page&limit&search&searchBy&status
// ============================================================

const SEARCH_FIELDS = {
  all: ["name", "customerId", "phone", "email"],
  name: ["name"],
  customerId: ["customerId"],
  phone: ["phone"],
};

const getPeople = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    search = "",
    searchBy = "all",
    status = "",
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  if (typeof search === "string" && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fields = SEARCH_FIELDS[searchBy] || SEARCH_FIELDS.all;

    filter.$or = fields.map((field) => ({
      [field]: { $regex: escapedSearch, $options: "i" },
    }));
  }

  if (status && VALID_STATUSES.includes(status)) {
    filter.status = status;
  }

  const [people, total] = await Promise.all([
    Person.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Person.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  res.status(200).json({
    people,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  });
});

// ============================================================
// GET PERSON BY ID
// @route GET /api/people/:id
// ============================================================

const getPersonById = asyncHandler(async (req, res) => {
  requireValidId(req, res);

  const person = await Person.findById(req.params.id).populate(
    "createdBy",
    "name email"
  );

  if (!person) fail(res, 404, "Person not found");

  res.status(200).json(person);
});

// ============================================================
// GET PERSON BY CUSTOMER ID (exact match)
// @route GET /api/people/by-customer-id/:customerId
// NOTE: register this route BEFORE "/:id" in your router
// ============================================================

const getPersonByCustomerId = asyncHandler(async (req, res) => {
  const customerId = String(req.params.customerId || "")
    .trim()
    .toUpperCase();

  if (!CUSTOMER_ID_REGEX.test(customerId)) {
    return res.status(400).json({ message: "Invalid Customer ID." });
  }

  const person = await Person.findOne({ customerId }).collation({
    locale: "en",
    strength: 2,
  });

  if (!person) {
    return res
      .status(404)
      .json({ message: `No customer found with ID "${customerId}".` });
  }

  res.status(200).json(person);
});

// ============================================================
// CREATE PERSON
// @route POST /api/people
// ============================================================

const createPerson = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    fail(res, 400, "Name is required");
  }

  const clean = sanitizePersonInput(req.body, res);

  // Drop undefined / null-photo keys so schema defaults still apply
  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });
  if (clean.photo === null) delete clean.photo;

  try {
    const person = await Person.create({
      ...clean,
      createdBy: req.user._id,
    });

    res.status(201).json(person);
  } catch (err) {
    // The photo was uploaded but the person was not saved -> don't leave
    // an orphan image in Cloudinary (unless something else uses it).
    if (clean.photo?.publicId) {
      await deletePhotoIfUnused(clean.photo.publicId);
    }
    rethrowDuplicate(err, res);
  }
});

// ============================================================
// UPDATE PERSON
// @route PUT /api/people/:id
// ============================================================

const UPDATABLE_FIELDS = [
  "customerId",
  "email",
  "phone",
  "address",
  "loanIds",
  "hasLoan",
  "billNumbers",
  "hasBill",
  "dateOfBirth",
  "gender",
  "extraInfo",
  "status",
  "source",
  "tags",
];

const updatePerson = asyncHandler(async (req, res) => {
  requireValidId(req, res);

  const person = await Person.findById(req.params.id);
  if (!person) fail(res, 404, "Person not found");

  const clean = sanitizePersonInput(req.body, res);
  const oldPhotoId = person.photo?.publicId;

  if (clean.name !== undefined) {
    if (!clean.name) fail(res, 400, "Name cannot be empty");
    person.name = clean.name;
  }

  UPDATABLE_FIELDS.forEach((field) => {
    if (clean[field] !== undefined) {
      person[field] = clean[field];
    }
  });

  // photo === undefined -> not sent, leave as is
  // photo === null      -> user removed it
  // photo = {url, ...}  -> new or unchanged photo
  if (clean.photo !== undefined) {
    person.photo = clean.photo === null ? undefined : clean.photo;
  }

  let updatedPerson;
  try {
    updatedPerson = await person.save();
  } catch (err) {
    // New photo was uploaded but the save failed -> remove the orphan
    if (clean.photo?.publicId && clean.photo.publicId !== oldPhotoId) {
      await deletePhotoIfUnused(clean.photo.publicId);
    }
    rethrowDuplicate(err, res);
  }

  // Delete the old image only after the person saved successfully,
  // and only if no bill or person still uses it
  if (oldPhotoId && oldPhotoId !== updatedPerson.photo?.publicId) {
    await deletePhotoIfUnused(oldPhotoId);
  }

  res.status(200).json(updatedPerson);
});

// ============================================================
// DELETE PERSON
// @route DELETE /api/people/:id
// ============================================================

const deletePerson = asyncHandler(async (req, res) => {
  const { adminPassword } = req.body;

  if (typeof adminPassword !== "string" || !adminPassword.trim()) {
    return res.status(400).json({ message: "Admin password is required" });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid person ID" });
  }

  const adminUser = await User.findById(req.user._id).select("+password");

  if (!adminUser) {
    return res.status(401).json({ message: "Admin account not found" });
  }

  if (adminUser.role !== "admin") {
    return res.status(403).json({ message: "Only an admin can delete a person" });
  }

  const passwordMatches = await bcrypt.compare(adminPassword, adminUser.password);

  if (!passwordMatches) {
    return res.status(403).json({ message: "Incorrect Admin password" });
  }

  const person = await Person.findById(req.params.id);

  if (!person) {
    return res.status(404).json({ message: "Person not found" });
  }

  const photoId = person.photo?.publicId;

  await person.deleteOne();

  // Remove the photo from Cloudinary after the person is gone,
  // unless a bill still uses the same image
  await deletePhotoIfUnused(photoId);

  // TODO (optional): clean up family-tree relations for this person here.

  res.json({ message: "Person deleted successfully" });
});

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getPeople,
  getPersonById,
  getPersonByCustomerId,
  createPerson,
  updatePerson,
  deletePerson,
};