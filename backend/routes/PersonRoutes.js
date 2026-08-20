const express = require('express');

const mongoose = require('mongoose');

const {
  getPeople,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
} = require('../controllers/PersonController');

const { protect } = require('../middleware/authMiddleware');

const { admin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Guards against malformed :id values (e.g. "abc") which would
// otherwise throw a Mongoose CastError deep in findById and surface
// as a misleading 500 — this turns it into a clean 404 up front.
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ message: 'Person not found' });
  }

  next();
};

// Get all people
// Create a new person
router
  .route('/')
  .get(protect, admin, getPeople)
  .post(protect, admin, createPerson);

// Get one person
// Update one person
// Delete one person
router
  .route('/:id')
  .get(validateObjectId, protect, admin, getPersonById)
  .put(validateObjectId, protect, admin, updatePerson)
  .delete(validateObjectId, protect, admin, deletePerson);

module.exports = router;