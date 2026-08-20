const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Relationship = require("../models/Relationship");
const Person = require("../models/Person");

// ============================================================
// Helper: Populate a relationship
// ============================================================

const populateRelationship = (query) => {
  return query
    .populate(
      "person1",
      "customerId name email phone address dateOfBirth gender status"
    )
    .populate(
      "person2",
      "customerId name email phone address dateOfBirth gender status"
    )
    .populate("createdBy", "name email");
};

// ============================================================
// @desc    Get all relationships
// @route   GET /api/relationships
// @access  Private/Admin
// ============================================================

const getRelationships = asyncHandler(async (req, res) => {
  const relationships = await populateRelationship(
    Relationship.find({})
  ).sort({ createdAt: -1 });

  res.status(200).json(relationships);
});

// ============================================================
// @desc    Get relationships for one person
// @route   GET /api/relationships/person/:personId
// @access  Private/Admin
// ============================================================

const getRelationshipsByPerson = asyncHandler(async (req, res) => {
  const { personId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(personId)) {
    res.status(404);
    throw new Error("Person not found");
  }

  const person = await Person.findById(personId);

  if (!person) {
    res.status(404);
    throw new Error("Person not found");
  }

  const relationships = await populateRelationship(
    Relationship.find({
      $or: [
        { person1: personId },
        { person2: personId },
      ],
    })
  ).sort({ createdAt: 1 });

  res.status(200).json(relationships);
});

// ============================================================
// @desc    Get one relationship
// @route   GET /api/relationships/:id
// @access  Private/Admin
// ============================================================

const getRelationshipById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  const relationship = await populateRelationship(
    Relationship.findById(id)
  );

  if (!relationship) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  res.status(200).json(relationship);
});

// ============================================================
// @desc    Create a relationship
// @route   POST /api/relationships
// @access  Private/Admin
// ============================================================

const createRelationship = asyncHandler(async (req, res) => {
  const {
    person1,
    person2,
    relationshipType,
    person1Role,
    person2Role,
  } = req.body;

  // ----------------------------------------------------------
  // Required fields
  // ----------------------------------------------------------

  if (!person1) {
    res.status(400);
    throw new Error("Person 1 is required");
  }

  if (!person2) {
    res.status(400);
    throw new Error("Person 2 is required");
  }

  if (!relationshipType) {
    res.status(400);
    throw new Error("Relationship type is required");
  }

  if (!person1Role) {
    res.status(400);
    throw new Error("Person 1 role is required");
  }

  if (!person2Role) {
    res.status(400);
    throw new Error("Person 2 role is required");
  }

  // ----------------------------------------------------------
  // Validate ObjectIds
  // ----------------------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(person1)) {
    res.status(400);
    throw new Error("Invalid person1 ID");
  }

  if (!mongoose.Types.ObjectId.isValid(person2)) {
    res.status(400);
    throw new Error("Invalid person2 ID");
  }

  // ----------------------------------------------------------
  // Prevent self relationship
  // ----------------------------------------------------------

  if (person1.toString() === person2.toString()) {
    res.status(400);
    throw new Error(
      "A person cannot have a relationship with themselves"
    );
  }

  // ----------------------------------------------------------
  // Check that both people exist
  // ----------------------------------------------------------

  const [person1Exists, person2Exists] = await Promise.all([
    Person.findById(person1),
    Person.findById(person2),
  ]);

  if (!person1Exists) {
    res.status(404);
    throw new Error("Person 1 not found");
  }

  if (!person2Exists) {
    res.status(404);
    throw new Error("Person 2 not found");
  }

  // ----------------------------------------------------------
  // Prevent duplicate relationship (application-level pre-check,
  // covers the reversed-order case: Gaurav->Raj vs Raj->Gaurav).
  // A unique compound index on the schema (person1, person2,
  // relationshipType) now backs this up at the DB level for the
  // exact-order case — see the catch block below.
  // ----------------------------------------------------------

  const existingRelationship = await Relationship.findOne({
    relationshipType,
    $or: [
      {
        person1,
        person2,
      },
      {
        person1: person2,
        person2: person1,
      },
    ],
  });

  if (existingRelationship) {
    res.status(409);
    throw new Error("This relationship already exists");
  }

  // ----------------------------------------------------------
  // Create relationship
  // FIX: wrapped in try/catch so that if two near-simultaneous
  // requests both pass the pre-check above, the database's unique
  // index (added to the schema) rejects the second insert with a
  // Mongo error code 11000, which we translate into a clean 409
  // instead of a raw 500.
  // ----------------------------------------------------------

  let relationship;

  try {
    relationship = await Relationship.create({
      person1,
      person2,
      relationshipType,
      person1Role: person1Role.trim(),
      person2Role: person2Role.trim(),
      createdBy: req.user._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error("This relationship already exists");
    }
    throw err;
  }

  // ----------------------------------------------------------
  // Return populated relationship
  // ----------------------------------------------------------

  const populatedRelationship = await populateRelationship(
    Relationship.findById(relationship._id)
  );

  res.status(201).json(populatedRelationship);
});

// ============================================================
// @desc    Update a relationship
// @route   PUT /api/relationships/:id
// @access  Private/Admin
// ============================================================

const updateRelationship = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  const relationship = await Relationship.findById(id);

  if (!relationship) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  const {
    person1,
    person2,
    relationshipType,
    person1Role,
    person2Role,
  } = req.body;

  // ----------------------------------------------------------
  // Calculate final values
  // ----------------------------------------------------------

  const finalPerson1 =
    person1 !== undefined
      ? person1
      : relationship.person1.toString();

  const finalPerson2 =
    person2 !== undefined
      ? person2
      : relationship.person2.toString();

  const finalRelationshipType =
    relationshipType !== undefined
      ? relationshipType
      : relationship.relationshipType;

  // ----------------------------------------------------------
  // Validate ObjectIds
  // ----------------------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(finalPerson1)) {
    res.status(400);
    throw new Error("Invalid person1 ID");
  }

  if (!mongoose.Types.ObjectId.isValid(finalPerson2)) {
    res.status(400);
    throw new Error("Invalid person2 ID");
  }

  // ----------------------------------------------------------
  // Prevent self relationship
  // ----------------------------------------------------------

  if (
    finalPerson1.toString() === finalPerson2.toString()
  ) {
    res.status(400);
    throw new Error(
      "A person cannot have a relationship with themselves"
    );
  }

  // ----------------------------------------------------------
  // Check both people exist
  // ----------------------------------------------------------

  const [person1Exists, person2Exists] = await Promise.all([
    Person.findById(finalPerson1),
    Person.findById(finalPerson2),
  ]);

  if (!person1Exists) {
    res.status(404);
    throw new Error("Person 1 not found");
  }

  if (!person2Exists) {
    res.status(404);
    throw new Error("Person 2 not found");
  }

  // ----------------------------------------------------------
  // Check duplicate relationship
  // ----------------------------------------------------------

  const duplicateRelationship = await Relationship.findOne({
    _id: { $ne: id },
    relationshipType: finalRelationshipType,
    $or: [
      {
        person1: finalPerson1,
        person2: finalPerson2,
      },
      {
        person1: finalPerson2,
        person2: finalPerson1,
      },
    ],
  });

  if (duplicateRelationship) {
    res.status(409);
    throw new Error("This relationship already exists");
  }

  // ----------------------------------------------------------
  // Apply changes
  // ----------------------------------------------------------

  if (person1 !== undefined) {
    relationship.person1 = person1;
  }

  if (person2 !== undefined) {
    relationship.person2 = person2;
  }

  if (relationshipType !== undefined) {
    relationship.relationshipType = relationshipType;
  }

  if (person1Role !== undefined) {
    relationship.person1Role = person1Role.trim();
  }

  if (person2Role !== undefined) {
    relationship.person2Role = person2Role.trim();
  }

  let updatedRelationship;

  try {
    updatedRelationship = await relationship.save();
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error("This relationship already exists");
    }
    throw err;
  }

  // ----------------------------------------------------------
  // Return populated result
  // ----------------------------------------------------------

  const populatedRelationship = await populateRelationship(
    Relationship.findById(updatedRelationship._id)
  );

  res.status(200).json(populatedRelationship);
});

// ============================================================
// @desc    Delete a relationship
// @route   DELETE /api/relationships/:id
// @access  Private/Admin
// ============================================================

const deleteRelationship = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  const relationship = await Relationship.findById(id);

  if (!relationship) {
    res.status(404);
    throw new Error("Relationship not found");
  }

  await relationship.deleteOne();

  res.status(200).json({
    message: "Relationship deleted successfully",
  });
});

// ============================================================
// @desc    Get family tree for a person
// @route   GET /api/relationships/tree/:personId
// @access  Private/Admin
// ============================================================

const getFamilyTree = asyncHandler(async (req, res) => {
  const { personId } = req.params;

  // ----------------------------------------------------------
  // Validate person ID
  // ----------------------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(personId)) {
    res.status(404);
    throw new Error("Person not found");
  }

  // ----------------------------------------------------------
  // Find the selected/root person
  // ----------------------------------------------------------

  const rootPerson = await Person.findById(personId).select(
    "customerId name email phone address dateOfBirth gender status"
  );

  if (!rootPerson) {
    res.status(404);
    throw new Error("Person not found");
  }

  // ----------------------------------------------------------
  // Find every relationship involving the root person
  // ----------------------------------------------------------

  const relationships = await populateRelationship(
    Relationship.find({
      $or: [
        { person1: personId },
        { person2: personId },
      ],
    })
  ).sort({ createdAt: 1 });

  // ----------------------------------------------------------
  // Family tree structure
  // ----------------------------------------------------------

  const familyTree = {
    root: rootPerson,
    parents: [],
    children: [],
    spouse: [],
    siblings: [],
    guardians: [],
    dependents: [],
    other: [],
    relationships: relationships,
  };

  // ----------------------------------------------------------
  // Process every relationship
  // ----------------------------------------------------------

  relationships.forEach((relationship) => {
    const isPerson1 =
      relationship.person1 &&
      relationship.person1._id.toString() ===
        personId.toString();

    const relatedPerson = isPerson1
      ? relationship.person2
      : relationship.person1;

    const relatedRole = isPerson1
      ? relationship.person2Role
      : relationship.person1Role;

    const currentPersonRole = isPerson1
      ? relationship.person1Role
      : relationship.person2Role;

    if (!relatedPerson) {
      return;
    }

    const relationshipItem = {
      person: relatedPerson,
      role: relatedRole,
      currentPersonRole,
      relationshipId: relationship._id,
      relationshipType: relationship.relationshipType,
    };

    // --------------------------------------------------------
    // Parent / Child
    // --------------------------------------------------------

    if (
      relationship.relationshipType === "parent_child"
    ) {
      const normalizedRole = String(
        relatedRole || ""
      ).toLowerCase();

      if (
        normalizedRole === "parent" ||
        normalizedRole === "father" ||
        normalizedRole === "mother" ||
        normalizedRole === "dad" ||
        normalizedRole === "mom"
      ) {
        familyTree.parents.push(relationshipItem);
      } else if (
        normalizedRole === "child" ||
        normalizedRole === "son" ||
        normalizedRole === "daughter"
      ) {
        familyTree.children.push(relationshipItem);
      } else {
        // If custom roles are being used, use the role
        // stored for the current person to determine direction.
        const currentRole = String(
          currentPersonRole || ""
        ).toLowerCase();

        if (
          currentRole === "child" ||
          currentRole === "son" ||
          currentRole === "daughter"
        ) {
          familyTree.parents.push(relationshipItem);
        } else if (
          currentRole === "parent" ||
          currentRole === "father" ||
          currentRole === "mother"
        ) {
          familyTree.children.push(relationshipItem);
        } else {
          familyTree.other.push(relationshipItem);
        }
      }

      return;
    }

    // --------------------------------------------------------
    // Spouse
    // --------------------------------------------------------

    if (
      relationship.relationshipType === "spouse"
    ) {
      familyTree.spouse.push(relationshipItem);
      return;
    }

    // --------------------------------------------------------
    // Sibling
    // --------------------------------------------------------

    if (
      relationship.relationshipType === "sibling"
    ) {
      familyTree.siblings.push(relationshipItem);
      return;
    }

    // --------------------------------------------------------
    // Guardian / Dependent
    // --------------------------------------------------------

    if (
      relationship.relationshipType ===
      "guardian_dependent"
    ) {
      const normalizedRole = String(
        relatedRole || ""
      ).toLowerCase();

      if (
        normalizedRole === "guardian"
      ) {
        familyTree.guardians.push(relationshipItem);
      } else if (
        normalizedRole === "dependent"
      ) {
        familyTree.dependents.push(relationshipItem);
      } else {
        const currentRole = String(
          currentPersonRole || ""
        ).toLowerCase();

        if (currentRole === "dependent") {
          familyTree.guardians.push(relationshipItem);
        } else if (currentRole === "guardian") {
          familyTree.dependents.push(relationshipItem);
        } else {
          familyTree.other.push(relationshipItem);
        }
      }

      return;
    }

    // --------------------------------------------------------
    // Other / Friend / Business Partner
    // FIX: "friend" and "business_partner" are now valid enum
    // values (see Relationship model) but previously had no
    // matching branch here, so they would silently disappear
    // from the rendered tree instead of showing up under
    // "Other Relationships".
    // --------------------------------------------------------

    if (
      relationship.relationshipType === "other" ||
      relationship.relationshipType === "friend" ||
      relationship.relationshipType === "business_partner"
    ) {
      familyTree.other.push(relationshipItem);
    }
  });

  // ----------------------------------------------------------
  // Return tree
  // ----------------------------------------------------------

  res.status(200).json(familyTree);
});

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getRelationships,
  getRelationshipById,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getRelationshipsByPerson,
  getFamilyTree,
};