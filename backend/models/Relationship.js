const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema(
  {
    person1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },

    person2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true,
      index: true,
    },

    relationshipType: {
      type: String,
      enum: [
        'parent_child',
        'spouse',
        'sibling',
        'guardian_dependent',
        'friend', // FIX: frontend offered this but schema rejected it
        'business_partner', // FIX: frontend offered this but schema rejected it
        'other',
      ],
      required: true,
    },

    person1Role: {
      type: String,
      required: true,
      trim: true,
    },

    person2Role: {
      type: String,
      required: true,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Helps find relationships involving a person quickly.
relationshipSchema.index({
  person1: 1,
  relationshipType: 1,
});

relationshipSchema.index({
  person2: 1,
  relationshipType: 1,
});

// FIX: enforce uniqueness at the database level for the exact (person1, person2,
// relationshipType) triple. This closes most of the race-condition window where
// two near-simultaneous requests could both pass the pre-check in the controller.
// The reversed-order case (person1/person2 swapped) is still handled at the
// application layer in the controller, since Mongo can't express "either order"
// in a single index.
relationshipSchema.index(
  { person1: 1, person2: 1, relationshipType: 1 },
  { unique: true }
);

module.exports = mongoose.model('Relationship', relationshipSchema);