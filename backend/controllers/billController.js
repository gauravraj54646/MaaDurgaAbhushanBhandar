const Bill = require('../models/Bill');
const mongoose = require('mongoose');
const Person = require('../models/Person');

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Accepts only a well-formed photo that lives in our "bills" folder.
const cleanPhoto = (photo) => {
  if (
    !photo ||
    typeof photo.url !== 'string' ||
    typeof photo.publicId !== 'string' ||
    !photo.publicId.startsWith('bills/') ||
    !photo.url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`)
  ) {
    return null;
  }
  return { url: photo.url, publicId: photo.publicId };
};

// Best-effort delete. A failure here should never break the bill request.
const deletePhotoFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err.message);
  }
};

// Escapes user input so it is safe inside a $regex (prevents crashes / ReDoS).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Adds the bill number to the matching person (by personId, else by phone).
// $addToSet makes it safe to run more than once.
const linkBillToPerson = async ({ personId, mobileNo, billNo }) => {
  try {
    let person = null;

    if (personId && mongoose.Types.ObjectId.isValid(personId)) {
      person = await Person.findById(personId);
    }

    if (!person && mobileNo) {
      person = await Person.findOne({ phone: String(mobileNo).trim() });
    }

    if (!person) return;

    await Person.updateOne(
      { _id: person._id },
      { $addToSet: { billNumbers: billNo }, $set: { hasBill: true } }
    );
  } catch (err) {
    console.error('linkBillToPerson failed:', err.message);
  }
};

// Removes a bill number from every Person that holds it and
// resets hasBill to false for people left with no bills.
const unlinkBillFromPeople = async (billNo) => {
  try {
    const people = await Person.find({ billNumbers: billNo }).select('_id');
    if (people.length === 0) return;

    const ids = people.map((p) => p._id);

    await Person.updateMany(
      { _id: { $in: ids } },
      { $pull: { billNumbers: billNo } }
    );

    await Person.updateMany(
      { _id: { $in: ids }, billNumbers: { $size: 0 } },
      { $set: { hasBill: false } }
    );
  } catch (err) {
    console.error('unlinkBillFromPeople failed:', err.message);
  }
};

// When a bill's number is edited, move it over on the Person records.
const renameBillOnPeople = async (oldBillNo, newBillNo) => {
  try {
    if (!oldBillNo || !newBillNo || oldBillNo === newBillNo) return;

    // $addToSet and $pull on the same field can't share one update.
    await Person.updateMany(
      { billNumbers: oldBillNo },
      { $addToSet: { billNumbers: newBillNo } }
    );
    await Person.updateMany(
      { billNumbers: oldBillNo },
      { $pull: { billNumbers: oldBillNo } }
    );
  } catch (err) {
    console.error('renameBillOnPeople failed:', err.message);
  }
};

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

const VALID_PAYMENT_STATUSES = ['paid', 'partial', 'pending'];

const getBills = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      billNo,
      billNos,
      customerName,
      mobileNo,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      paymentStatus,
      sortBy = 'billDate',
      sortOrder = 'desc',
    } = req.query;

    const filter = { isDeleted: false };

    // MULTIPLE BILL NUMBERS
    // Example: ?billNos=INV0001,INV0002,INV0003
    if (billNos) {
      const billNumberList = [
        ...new Set(
          (Array.isArray(billNos) ? billNos : String(billNos).split(','))
            .map((num) => String(num).trim().toUpperCase())
            .filter(Boolean)
        ),
      ];

      if (
        billNumberList.length === 0 ||
        billNumberList.length > 100 ||
        billNumberList.some((num) => !/^[A-Z0-9]{1,15}$/.test(num))
      ) {
        return res.status(400).json({ message: 'Invalid bill numbers.' });
      }

      filter.billNo = { $in: billNumberList };
    }
    // SINGLE / PARTIAL BILL NUMBER SEARCH
    else if (billNo) {
      const cleanBillNo = String(billNo).trim();
      if (cleanBillNo) {
        filter.billNo = {
          $regex: escapeRegex(cleanBillNo),
          $options: 'i',
        };
      }
    }

    // CUSTOMER NAME SEARCH
    if (customerName) {
      const cleanName = String(customerName).trim();
      if (cleanName) {
        filter.customerName = {
          $regex: escapeRegex(cleanName),
          $options: 'i',
        };
      }
    }

    // MOBILE NUMBER SEARCH (partial, digits only, e.g. last 4 digits)
    if (mobileNo) {
      const digitsOnly = String(mobileNo).replace(/\D/g, '').slice(0, 10);

      if (digitsOnly) {
        filter.mobileNo = { $regex: digitsOnly };
      }
    }

    // PAYMENT STATUS (whitelisted)
    if (paymentStatus) {
      if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ message: 'Invalid payment status.' });
      }
      filter.paymentStatus = paymentStatus;
    }

    if (fromDate || toDate) {
      filter.billDate = {};

      if (fromDate) {
        filter.billDate.$gte = new Date(fromDate);
      }

      if (toDate) {
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

    // Allowed sorting fields
    const allowedSortFields = ['billDate', 'grandTotal', 'customerName'];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'billDate';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .select(
          'billNo billDate billType customerName mobileNo grandTotal paymentStatus balanceDue photo.url'
        )
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

// @desc    Find one bill by exact bill number
// @route   GET /api/bills/by-bill-no/:billNo
const getBillByBillNo = async (req, res) => {
  try {
    const billNo = String(req.params.billNo || '').trim().toUpperCase();

    if (!/^[A-Z0-9]{1,15}$/.test(billNo)) {
      return res.status(400).json({ message: 'Invalid Bill No.' });
    }

    const bill = await Bill.findOne({ billNo, isDeleted: false });

    if (!bill) {
      return res
        .status(404)
        .json({ message: `No bill found with Bill No. "${billNo}".` });
    }

    res.json(bill);
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
      soldBy, notes, personId,
      billType, description, simpleAmount,
       photo,
    } = req.body;

    const bill = new Bill({
      billNo: billNo ? billNo.trim().toUpperCase() : await generateBillNo(),
      billDate,
      billType: billType === 'simple' ? 'simple' : 'jewellery',
      description,
      simpleAmount,
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
      ...(cleanPhoto(photo) && { photo: cleanPhoto(photo) }),
      isDeleted: false,
    });

    const createdBill = await bill.save();

    await linkBillToPerson({
      personId,
      mobileNo: createdBill.mobileNo,
      billNo: createdBill.billNo,
    });

    res.status(201).json(createdBill);
  } catch (error) {
    // If an auto-generated billNo collided with one created concurrently,
    // retry once with a freshly generated number.
    if (error.code === 11000 && error.keyPattern?.billNo && !req.body.billNo) {
      try {
        const bill = new Bill({
          ...req.body,
          photo: cleanPhoto(req.body.photo) || undefined,
          payments: cleanPayments(req.body.payments),
          billNo: await generateBillNo(),
          isDeleted: false,
        });
        const createdBill = await bill.save();
        await linkBillToPerson({
          personId: req.body.personId,
          mobileNo: createdBill.mobileNo,
          billNo: createdBill.billNo,
        });
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
      billType, description, simpleAmount,
      photo,
    } = req.body;

    const bill = await Bill.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (bill) {
      const oldBillNo = bill.billNo;
      const oldPhotoId = bill.photo?.publicId;
      bill.billNo = billNo ? billNo.trim().toUpperCase() : bill.billNo;
      bill.billDate = billDate ?? bill.billDate;
      bill.billType = billType ?? bill.billType;
      bill.description = description ?? bill.description;
      bill.simpleAmount = simpleAmount ?? bill.simpleAmount;
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

      // Like items/exchangeItems, this replaces the whole array. The
      // caller (Edit Bill page) is expected to send back the full set
      // of payments (existing ones plus any newly added), not just
      // the new one, since there's no separate "append" endpoint.
      if (payments) {
        bill.payments = cleanPayments(payments);
      }
      // photo === undefined -> not sent, leave as is
      // photo === null      -> user removed it
      // photo = {url, ...}  -> new or unchanged photo
if (photo !== undefined) {
  if (photo === null) {
    bill.photo = undefined;
  } else {
    const validPhoto = cleanPhoto(photo);
    if (!validPhoto) {
      return res.status(400).json({ message: 'Invalid photo data.' });
    }
    bill.photo = validPhoto;
  }
}
      // .save() re-runs the pre-validate hook, so totals/tax/balanceDue
      // (and, when payments[] is non-empty, amountPaid/paymentMode too)
      // are recalculated from the updated data.
      const updatedBill = await bill.save();

     // Delete the old image from Cloudinary only after the bill saved successfully
      if (oldPhotoId && oldPhotoId !== updatedBill.photo?.publicId) {
        await deletePhotoFromCloudinary(oldPhotoId);
      }

      // Keep Person.billNumbers in sync if the bill number was edited.
      await renameBillOnPeople(oldBillNo, updatedBill.billNo);

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
  const photoId = bill.photo?.publicId;

  bill.isDeleted = true;
  bill.photo = undefined;
  await bill.save();

  await deletePhotoFromCloudinary(photoId);
  await unlinkBillFromPeople(bill.billNo);

  res.json({ message: 'Bill deleted successfully' });
}else {
      res.status(404).json({ message: 'Bill not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBills,
  getBillById,
  getBillByBillNo,
  createBill,
  updateBill,
  deleteBill,
};