const Bill = require('../models/Bill');

// Generates the next sequential bill number, e.g. INV0001 -> INV0002.
// Falls back to INV0001 when no bills exist yet.
const generateBillNo = async () => {
  const lastBill = await Bill.findOne({})
    .sort({ createdAt: -1 })
    .select('billNo');

  if (!lastBill) return 'INV0001';

  const match = lastBill.billNo.match(/(\d+)$/);
  const prefix = match ? lastBill.billNo.slice(0, -match[1].length) : 'INV';
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  const width = match ? match[1].length : 4;

  return `${prefix}${String(nextNum).padStart(width, '0')}`;
};

// Normalizes a raw payments[] array from the client into the shape
// the Payment sub-schema expects. Shared by createBill/updateBill so
// both stay in sync.
const cleanPayments = (payments) =>
  (payments || []).map((p) => ({
    date: p.date,
    amount: p.amount,
    mode: p.mode,
  }));

const getBills = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      billNo,
      customerName, // partial, case-insensitive match
      mobileNo, // partial match
      fromDate, // inclusive lower bound on billDate
      toDate, // inclusive upper bound on billDate
      minAmount, // inclusive lower bound on grandTotal
      maxAmount, // inclusive upper bound on grandTotal
      paymentStatus, // 'paid' | 'partial' | 'pending'
      sortBy = 'billDate', // 'billDate' | 'grandTotal' | 'customerName'
      sortOrder = 'desc', // 'asc' | 'desc'
    } = req.query;

    const filter = { isDeleted: false };

    if (billNo) {
      filter.billNo = { $regex: billNo.trim(), $options: 'i' };
    }
    if (customerName) {
      filter.customerName = { $regex: customerName.trim(), $options: 'i' };
    }
    if (mobileNo) {
      // Strip everything but digits, capped at 10 (a full Indian
      // mobile number) so oversized/garbage input can't be used to
      // build a huge regex.
      const digitsOnly = mobileNo.trim().replace(/\D/g, '').slice(0, 10);

      if (digitsOnly) {
        filter.mobileNo = { $regex: digitsOnly, $options: 'i' };
      }
    }
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (fromDate || toDate) {
      filter.billDate = {};

      if (fromDate) {
        filter.billDate.$gte = new Date(fromDate);
      }

      if (toDate) {
        // include the whole day for the "to" bound
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.billDate.$lte = end;
      }
    }

    if (minAmount || maxAmount) {
      filter.grandTotal = {};

      if (minAmount) {
        filter.grandTotal.$gte = Number(minAmount);
      }

      if (maxAmount) {
        filter.grandTotal.$lte = Number(maxAmount);
      }
    }

    // Only these fields may be sorted on — prevents arbitrary/unsafe
    // sort keys being passed in via query string.
    const allowedSortFields = ['billDate', 'grandTotal', 'customerName'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'billDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        // Bills list needs the summary fields for the table, without
        // pulling the full items/exchangeItems arrays for every row.
        .select('billNo billDate customerName mobileNo grandTotal paymentStatus balanceDue')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum),
      Bill.countDocuments(filter),
    ]);

    res.json({
      bills,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (bill) {
      res.json(bill);
    } else {
      res.status(404).json({ message: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBill = async (req, res) => {
  try {
    const {
      billNo, billDate,
      customerName, mobileNo, address, gstin,
      items, exchangeItems,
      discount, cgstPercent, sgstPercent,
      payments, paymentMode, amountPaid,
      soldBy, notes,
    } = req.body;

    const bill = new Bill({
      billNo: billNo ? billNo.trim().toUpperCase() : await generateBillNo(),
      billDate,
      customerName,
      mobileNo,
      address,
      gstin,
      items: (items || []).map((i) => ({
        itemName: i.itemName,
        category: i.category,
        huid: i.huid,
        purity: i.purity,
        hsnCode: i.hsnCode,
        grossWeight: i.grossWeight,
        stoneWeight: i.stoneWeight,
        netWeight: i.netWeight,
        ratePerGram: i.ratePerGram,
        makingChargeType: i.makingChargeType,
        makingCharge: i.makingCharge,
        wastagePercent: i.wastagePercent,
        stoneCharge: i.stoneCharge,
        quantity: i.quantity,
      })),
      exchangeItems: (exchangeItems || []).map((e) => ({
        description: e.description,
        category: e.category,
        grossWeight: e.grossWeight,
        purity: e.purity,
        deduction: e.deduction,
        netWeight: e.netWeight,
        ratePerGram: e.ratePerGram,
      })),
      discount,
      cgstPercent,
      sgstPercent,
      // payments[] is the source of truth going forward - the
      // pre("validate") hook derives amountPaid/paymentMode from it
      // when non-empty. paymentMode/amountPaid are still accepted
      // directly as a fallback for callers that don't send payments.
      payments: cleanPayments(payments),
      paymentMode,
      amountPaid,
      soldBy,
      notes,
      isDeleted: false,
    });

    const createdBill = await bill.save();

    res.status(201).json(createdBill);
  } catch (error) {
    // If an auto-generated billNo collided with one created concurrently,
    // retry once with a freshly generated number.
    if (error.code === 11000 && error.keyPattern?.billNo && !req.body.billNo) {
      try {
        const bill = new Bill({
          ...req.body,
          payments: cleanPayments(req.body.payments),
          billNo: await generateBillNo(),
          isDeleted: false,
        });
        const createdBill = await bill.save();
        return res.status(201).json(createdBill);
      } catch (retryError) {
        return res.status(400).json({ message: retryError.message });
      }
    }

    res.status(400).json({ message: error.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const {
      billNo, billDate,
      customerName, mobileNo, address, gstin,
      items, exchangeItems,
      discount, cgstPercent, sgstPercent,
      payments, paymentMode, amountPaid,
      soldBy, notes, isCancelled,
    } = req.body;

    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (bill) {
      bill.billNo = billNo ? billNo.trim().toUpperCase() : bill.billNo;
      bill.billDate = billDate ?? bill.billDate;
      bill.customerName = customerName ?? bill.customerName;
      bill.mobileNo = mobileNo ?? bill.mobileNo;
      bill.address = address ?? bill.address;
      bill.gstin = gstin ?? bill.gstin;
      bill.discount = discount ?? bill.discount;
      bill.cgstPercent = cgstPercent ?? bill.cgstPercent;
      bill.sgstPercent = sgstPercent ?? bill.sgstPercent;
      bill.paymentMode = paymentMode ?? bill.paymentMode;
      bill.amountPaid = amountPaid ?? bill.amountPaid;
      bill.soldBy = soldBy ?? bill.soldBy;
      bill.notes = notes ?? bill.notes;
      bill.isCancelled = isCancelled ?? bill.isCancelled;

      if (items) {
        bill.items = items.map((i) => ({
          itemName: i.itemName,
          category: i.category,
          huid: i.huid,
          purity: i.purity,
          hsnCode: i.hsnCode,
          grossWeight: i.grossWeight,
          stoneWeight: i.stoneWeight,
          netWeight: i.netWeight,
          ratePerGram: i.ratePerGram,
          makingChargeType: i.makingChargeType,
          makingCharge: i.makingCharge,
          wastagePercent: i.wastagePercent,
          stoneCharge: i.stoneCharge,
          quantity: i.quantity,
        }));
      }

      if (exchangeItems) {
        bill.exchangeItems = exchangeItems.map((e) => ({
          description: e.description,
          category: e.category,
          grossWeight: e.grossWeight,
          purity: e.purity,
          deduction: e.deduction,
          netWeight: e.netWeight,
          ratePerGram: e.ratePerGram,
        }));
      }

      // Like items/exchangeItems, this replaces the whole array — the
      // caller (Edit Bill page) is expected to send back the full set
      // of payments (existing ones plus any newly added), not just
      // the new one, since there's no separate "append" endpoint.
      if (payments) {
        bill.payments = cleanPayments(payments);
      }

      // .save() re-runs the pre-validate hook, so totals/tax/balanceDue
      // (and, when payments[] is non-empty, amountPaid/paymentMode too)
      // are recalculated from the updated data.
      const updatedBill = await bill.save();

      res.json(updatedBill);
    } else {
      res.status(404).json({ message: 'Bill not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (bill) {
      bill.isDeleted = true;

      await bill.save();

      res.json({
        message: 'Bill deleted successfully',
      });
    } else {
      res.status(404).json({
        message: 'Bill not found',
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
};