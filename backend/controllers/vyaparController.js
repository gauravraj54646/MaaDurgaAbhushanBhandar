const Vyapar = require('../models/Vyapar');

const getVyapars = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      name, // partial, case-insensitive match
      customerId,
      phone, // partial match against mobileNo
      loan, // filter by linked Loan _id
      metal, // 'gold' | 'silver' — only records that pledged this metal
      sortBy = 'createdAt', // 'createdAt' | 'name'
      sortOrder = 'desc', // 'asc' | 'desc'
    } = req.query;

    const filter = { isDeleted: false };

    if (name) {
      filter.name = { $regex: name.trim(), $options: 'i' };
    }
    if (customerId) {
      filter.customerId = customerId.trim().toUpperCase();
    }
    if (loan) {
      filter.loan = loan;
    }
    if (phone) {
      // Strip everything but digits, capped at 10 (a full Indian
      // mobile number) so oversized/garbage input can't be used to
      // build a huge regex.
      const digitsOnly = phone.trim().replace(/\D/g, '').slice(0, 10);

      if (digitsOnly) {
        filter.mobileNo = { $regex: digitsOnly, $options: 'i' };
      }
    }
    if (metal) {
      filter['items.metal'] = metal;
    }

    // Only these fields may be sorted on — prevents arbitrary/unsafe
    // sort keys being passed in via query string.
    const allowedSortFields = ['createdAt', 'name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [vyapars, total] = await Promise.all([
      Vyapar.find(filter)
        // 'items' is included (not just an id/name projection) because
        // the schema's totalGoldNetWeight/totalSilverNetWeight/etc.
        // virtuals are derived from it — without the raw items the
        // virtuals would just come back as 0 in the list response.
        .select('name customerId mobileNo loan items createdAt')
        .populate('loan', 'loanId loanAmount date dueDate available')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum),
      Vyapar.countDocuments(filter),
    ]);

    res.json({
      vyapars,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getVyaparById = async (req, res) => {
  try {
    const vyapar = await Vyapar.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).populate('loan');

    if (vyapar) {
      res.json(vyapar);
    } else {
      res.status(404).json({ message: 'Record not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createVyapar = async (req, res) => {
  try {
    const {
      name, address, customerId, mobileNo, description, loan, items,
    } = req.body;

    const vyapar = new Vyapar({
      name,
      address,
      customerId,
      mobileNo,
      description,
      loan,
      isDeleted: false,
      items: (items || []).map((i) => ({
        metal: i.metal,
        grossWeight: i.grossWeight,
        tunch: i.tunch,
        labour: i.labour,
        description: i.description,
        // finePayments can be seeded on create (rare — usually they're
        // added later via addFinePayment as the customer pays over
        // time), but supported here for completeness/import cases.
        finePayments: (i.finePayments || []).map((p) => ({
          date: p.date,
          rate: p.rate,
          fineWeight: p.fineWeight,
        })),
      })),
    });

    // .save() runs the schema's validators AND the pre-validate hooks
    // that derive netWeight and check finePayments don't exceed it.
    const createdVyapar = await vyapar.save();

    res.status(201).json(createdVyapar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateVyapar = async (req, res) => {
  try {
    const {
      name, address, customerId, mobileNo, description, loan, items,
    } = req.body;

    const vyapar = await Vyapar.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (vyapar) {
      vyapar.name = name ?? vyapar.name;
      vyapar.address = address ?? vyapar.address;
      vyapar.customerId = customerId ?? vyapar.customerId;
      vyapar.mobileNo = mobileNo ?? vyapar.mobileNo;
      vyapar.description = description ?? vyapar.description;
      vyapar.loan = loan ?? vyapar.loan;

      // NOTE: like reloans/payments on the Loan model, sending `items`
      // here REPLACES the whole array, finePayments included. If the
      // client is only recording one day's payment against one item,
      // use POST /:id/items/:itemId/fine-payments (addFinePayment)
      // below instead of round-tripping the full items array — that
      // avoids ever dropping another item's payment history because
      // the client's copy of it was stale or incomplete.
      if (items) {
        vyapar.items = items.map((i) => ({
          metal: i.metal,
          grossWeight: i.grossWeight,
          tunch: i.tunch,
          labour: i.labour,
          description: i.description,
          finePayments: (i.finePayments || []).map((p) => ({
            date: p.date,
            rate: p.rate,
            fineWeight: p.fineWeight,
          })),
        }));
      }

      const updatedVyapar = await vyapar.save();

      res.json(updatedVyapar);
    } else {
      res.status(404).json({ message: 'Record not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Records one dated fine-weight settlement against a single item,
// without touching any other item or any other payment already on
// this one. This is the normal day-to-day operation — updateVyapar's
// full-array replace is meant for editing item details, not for
// logging payments.
const addFinePayment = async (req, res) => {
  try {
    const { date, rate, fineWeight } = req.body;

    const vyapar = await Vyapar.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!vyapar) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const item = vyapar.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.finePayments.push({ date, rate, fineWeight });

    // Triggers the item's pre-validate hook again, so the "total paid
    // can't exceed netWeight" guard still applies to this new entry.
    const updatedVyapar = await vyapar.save();

    res.json(updatedVyapar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteVyapar = async (req, res) => {
  try {
    const vyapar = await Vyapar.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (vyapar) {
      vyapar.isDeleted = true;

      await vyapar.save();

      res.json({
        message: 'Record deleted successfully',
      });
    } else {
      res.status(404).json({
        message: 'Record not found',
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getVyapars,
  getVyaparById,
  createVyapar,
  updateVyapar,
  addFinePayment,
  deleteVyapar,
};