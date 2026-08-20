const express = require("express");
const mongoose = require("mongoose");

const {
  getRelationships,
  getRelationshipById,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getRelationshipsByPerson,
  getFamilyTree,
} = require("../controllers/RelationshipController");

const { protect } = require("../middleware/authMiddleware");
const { admin } = require("../middleware/adminMiddleware");

const router = express.Router();

// ============================================================
// Validate MongoDB ObjectId
// ============================================================

const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({
      message: "Relationship not found",
    });
  }

  next();
};

// ============================================================
// GET ALL RELATIONSHIPS
// POST NEW RELATIONSHIP
//
// GET  /api/relationships
// POST /api/relationships
// ============================================================

router
  .route("/")
  .get(protect, admin, getRelationships)
  .post(protect, admin, createRelationship);

// ============================================================
// GET RELATIONSHIPS FOR ONE PERSON
//
// GET /api/relationships/person/:personId
//
// IMPORTANT:
// This route must come before /:id.
// ============================================================

router.get(
  "/person/:personId",
  protect,
  admin,
  getRelationshipsByPerson
);

// ============================================================
// GET FAMILY TREE
//
// GET /api/relationships/tree/:personId
//
// IMPORTANT:
// This route must come before /:id.
// ============================================================

router.get(
  "/tree/:personId",
  protect,
  admin,
  getFamilyTree
);

// ============================================================
// GET / UPDATE / DELETE ONE RELATIONSHIP
//
// GET    /api/relationships/:id
// PUT    /api/relationships/:id
// DELETE /api/relationships/:id
// ============================================================

router
  .route("/:id")
  .get(
    validateObjectId,
    protect,
    admin,
    getRelationshipById
  )
  .put(
    validateObjectId,
    protect,
    admin,
    updateRelationship
  )
  .delete(
    validateObjectId,
    protect,
    admin,
    deleteRelationship
  );

module.exports = router;