import React, { useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import BillPhotoUpload from "../components/BillPhotoUpload";

// =========================================================
// MODULE-LEVEL HELPERS (defined before the component)
// =========================================================

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

const isMobileScreen = () =>
  typeof window !== "undefined" && window.innerWidth <= 780;

// Collision-proof ids for rows (items / exchange / payments)
let idCounter = 0;
const makeId = () => {
  idCounter += 1;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2)}`;
};

const getToday = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return "-";

  const d = new Date(isoDate);

  if (Number.isNaN(d.getTime())) return isoDate;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const numberToWords = (num) => {
  num = Number(num);

  if (!Number.isFinite(num) || num === 0) {
    return "";
  }

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  const convertTwoDigits = (n) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };

  const convertThreeDigits = (n) => {
    if (n < 100) return convertTwoDigits(n);
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + convertTwoDigits(n % 100) : "")
    );
  };

  const integerPart = Math.floor(num);

  if (integerPart >= 1000000000) {
    return "Amount Too Large";
  }

  let result = "";

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore) result += convertThreeDigits(crore) + " Crore ";
  if (lakh) result += convertTwoDigits(lakh) + " Lakh ";
  if (thousand) result += convertTwoDigits(thousand) + " Thousand ";
  if (remainder) result += convertThreeDigits(remainder);

  return result.trim() + " Rupees Only";
};

const emptyForm = () => ({
  billNo: "", // left blank -> backend auto-generates (INV0001, ...)
  billDate: getToday(),
  billType: "simple",
  description: "",
  simpleAmount: "",

  customerName: "",
  mobileNo: "",
  address: "",
  gstin: "",

  items: [],
  exchangeItems: [],

  discount: "",
  cgstPercent: 1.5,
  sgstPercent: 1.5,

  payments: [{ id: makeId(), date: getToday(), amount: "", mode: "cash" }],

  soldBy: "",
  notes: "",
  photo: null,
  customerPhoto: null, // optional photo of the customer
});

// =========================================================
// DESCRIPTION HELPER (jewellery lines -> description text + total)
// =========================================================

const LINE_TYPES = {
  gold: { label: "Gold", icon: "🥇", sign: 1 },
  silver: { label: "Silver", icon: "🥈", sign: 1 },
  oldGold: { label: "Old Gold", icon: "♻️", sign: -1 },
  oldSilver: { label: "Old Silver", icon: "♻️", sign: -1 },
  discount: { label: "Discount", icon: "🏷️", sign: -1 },
};

// kind: "num" = plain decimal, "money" = ₹ input
const LINE_FIELDS = {
  gold: [
    { key: "name", label: "Item Name", kind: "text" },
    { key: "weight", label: "Weight (g)", kind: "num" },
    { key: "rate", label: "Rate / gram", kind: "money" },
    { key: "making", label: "Making (%)", kind: "num" },
  ],
  silver: [
    { key: "name", label: "Item Name", kind: "text" },
    { key: "weight", label: "Weight (g)", kind: "num" },
    { key: "rate", label: "Rate / 10 gram", kind: "money" },
    { key: "making", label: "Making / gram", kind: "money" },
  ],
  oldGold: [
    { key: "weight", label: "Weight (g)", kind: "num" },
    { key: "rate", label: "Rate / gram", kind: "money" },
  ],
  oldSilver: [
    { key: "weight", label: "Weight (g)", kind: "num" },
    { key: "rate", label: "Rate / 10 gram", kind: "money" },
  ],
  discount: [{ key: "amount", label: "Discount Amount", kind: "money" }],
};

const MAX_HELPER_LINES = 50;

const newLine = (type) => ({
  id: makeId(),
  type,
  name: "",
  weight: "",
  rate: "",
  making: "",
  amount: "",
});

const cleanDecimal = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toFixed(2);

const computeLine = (line) => {
  const w = Number(line.weight || 0);
  const r = Number(line.rate || 0);
  const m = Number(line.making || 0);
  const a = Number(line.amount || 0);

  switch (line.type) {
    case "gold": {
      const metal = w * r;
      const making = metal * (m / 100);
      return { metal, making, total: metal + making };
    }
    case "silver": {
      const metal = (w * r) / 10;
      const making = w * m;
      return { metal, making, total: metal + making };
    }
    case "oldGold":
      return { metal: w * r, making: 0, total: w * r };
    case "oldSilver":
      return { metal: (w * r) / 10, making: 0, total: (w * r) / 10 };
    case "discount":
      return { metal: a, making: 0, total: a };
    default:
      return { metal: 0, making: 0, total: 0 };
  }
};

const describeLine = (line, n) => {
  const c = computeLine(line);
  const w = line.weight || 0;
  const r = line.rate || 0;
  const m = line.making || 0;
  const nm = line.name && line.name.trim() ? ` (${line.name.trim()})` : "";

  switch (line.type) {
    case "gold":
      return `GOLD ${n}${nm}: ${w} g x Rs.${r}/g = Rs.${money(c.metal)} + Making ${m}% = Rs.${money(c.making)} => Rs.${money(c.total)}`;
    case "silver":
      return `SILVER ${n}${nm}: ${w} g x Rs.${r}/10g = Rs.${money(c.metal)} + Making Rs.${m}/g = Rs.${money(c.making)} => Rs.${money(c.total)}`;
    case "oldGold":
      return `OLD GOLD ${n}: ${w} g x Rs.${r}/g = - Rs.${money(c.total)}`;
    case "oldSilver":
      return `OLD SILVER ${n}: ${w} g x Rs.${r}/10g = - Rs.${money(c.total)}`;
    case "discount":
      return `DISCOUNT${n > 1 ? ` ${n}` : ""}: - Rs.${money(c.total)}`;
    default:
      return "";
  }
};

const buildDescription = (lines) => {
  const counters = {};
  const out = [];
  let additions = 0;
  let deductions = 0;

  lines.forEach((line) => {
    const c = computeLine(line);
    if (c.total <= 0) return; // skip empty rows

    counters[line.type] = (counters[line.type] || 0) + 1;
    out.push(describeLine(line, counters[line.type]));

    if (LINE_TYPES[line.type].sign > 0) additions += c.total;
    else deductions += c.total;
  });

  const total = additions - deductions;

  if (out.length > 0) {
    const words = total > 0 ? numberToWords(Math.round(total)) : "";
    out.push(
      `TOTAL AMOUNT: Rs.${money(Math.max(total, 0))}${words ? ` (${words})` : ""}`
    );
  }

  return { text: out.join("\n"), additions, deductions, total };
};

const AddBillProduct = () => {
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPersonFromState = location.state?.person || null;
  const statePersonId = selectedPersonFromState?._id || null;
  const personIdFromQuery = new URLSearchParams(location.search).get("personId");
  const [selectedPerson, setSelectedPerson] = useState(selectedPersonFromState);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [customerPhotoBusy, setCustomerPhotoBusy] = useState(false);
  const uploading = photoBusy || customerPhotoBusy;
  // Changing this key resets the Description Helper's rows
  const [helperKey, setHelperKey] = useState(0);

  // Keep the latest router-state person in a ref so the effect below can
  // depend on the person's id only (avoids re-running and overwriting
  // fields the user already typed).
  const statePersonRef = useRef(selectedPersonFromState);
  statePersonRef.current = selectedPersonFromState;

  // =========================================================
  // REFS (for scroll-to-error on invalid submit)
  // =========================================================

  const fieldRefs = useRef({});

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState(emptyForm);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  // Receives generated text + total from the Description Helper
  const applyHelper = ({ text, total }) => {
    setFormData((prev) => ({
      ...prev,
      description: text,
      simpleAmount: total > 0 ? String(round2(total)) : prev.simpleAmount,
    }));

    setErrors((prev) => ({
      ...prev,
      description: "",
      simpleAmount: total > 0 ? "" : prev.simpleAmount,
    }));
  };

  // =========================================================
  // COLLAPSED CARDS (UI only - never sent to the server)
  // keys: item_<id>, ex_<id>, pay_<id>   value: true = collapsed
  // =========================================================

  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // =========================================================
  // ADMIN GUARD (redirect inside an effect, not during render)
  // =========================================================

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  // =========================================================
  // LOAD PERSON (from router state or ?personId=)
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const applyPerson = (person) => {
      if (!person || cancelled) return;

      setSelectedPerson(person);

      setFormData((prev) => ({
        ...prev,
        customerName: (person.name || "").toUpperCase(),
        mobileNo: person.phone || "",
        address: person.address || "",
      }));
    };

    if (statePersonRef.current) {
      applyPerson(statePersonRef.current);
    }

    if (personIdFromQuery && user?.token) {
      (async () => {
        try {
          const response = await fetch(`/api/people/${personIdFromQuery}`, {
            headers: { Authorization: `Bearer ${user.token}` },
          });
          const data = await response.json();
          if (response.ok) applyPerson(data);
        } catch (error) {
          console.error("Failed to load person:", error);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [personIdFromQuery, user?.token, statePersonId]);

  // =========================================================
  // BILL NO SEARCH (load an existing bill)
  // =========================================================

  const [loadedBillId, setLoadedBillId] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState({ type: "", text: "" });

  const handleBillSearch = async () => {
    const billNo = formData.billNo.trim().toUpperCase();

    if (!billNo) {
      setSearchMessage({ type: "error", text: "Enter a Bill No. to search." });
      return;
    }

    if (!user?.token) {
      setSearchMessage({
        type: "error",
        text: "Session expired. Please log in again.",
      });
      return;
    }

    setSearchLoading(true);
    setSearchMessage({ type: "", text: "" });

    try {
      const res = await fetch(
        `/api/bills/by-bill-no/${encodeURIComponent(billNo)}`,
        { headers: { Authorization: `Bearer ${user.token}` } },
      );

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check the API server is running.`,
        );
      }

      const bill = await res.json();

      if (res.status === 404) {
        setSearchMessage({
          type: "error",
          text: `No bill found with Bill No. "${billNo}".`,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(bill.message || "Failed to search bill.");
      }

      const str = (v) => (v === undefined || v === null ? "" : String(v));

      const loadedItems = (bill.items || []).map((i) => ({
        id: makeId(),
        itemName: i.itemName || "",
        category: i.category || "gold",
        huid: i.huid || "",
        purity: i.purity || "",
        hsnCode: i.hsnCode || "",
        grossWeight: str(i.grossWeight),
        stoneWeight: str(i.stoneWeight),
        netWeight: str(i.netWeight),
        ratePerGram: str(i.ratePerGram),
        makingChargeType: i.makingChargeType || "perGram",
        makingCharge: str(i.makingCharge),
        wastagePercent: str(i.wastagePercent),
        stoneCharge: str(i.stoneCharge),
        quantity: str(i.quantity || 1),
      }));

      const loadedExchange = (bill.exchangeItems || []).map((e) => ({
        id: makeId(),
        description: e.description || "",
        category: e.category || "gold",
        grossWeight: str(e.grossWeight),
        purity: e.purity || "",
        deduction: str(e.deduction),
        netWeight: str(e.netWeight),
        ratePerGram: str(e.ratePerGram),
      }));

      const loadedPayments = (bill.payments || []).map((p) => ({
        id: makeId(),
        date: toDateInput(p.date) || getToday(),
        amount: str(p.amount),
        mode: p.mode || "cash",
      }));

      // If an old bill has no billType, infer it from its content.
      const inferredType =
        bill.billType ||
        ((bill.items || []).length > 0 ? "jewellery" : "simple");

      setFormData({
        billNo: bill.billNo || billNo,
        billDate: toDateInput(bill.billDate) || getToday(),
        billType: inferredType,
        description: bill.description || "",
        simpleAmount: bill.simpleAmount ? String(bill.simpleAmount) : "",

        customerName: bill.customerName || "",
        mobileNo: bill.mobileNo || "",
        address: bill.address || "",
        gstin: bill.gstin || "",

        items: loadedItems,
        exchangeItems: loadedExchange,

        discount: bill.discount ? str(bill.discount) : "",
        cgstPercent: bill.cgstPercent ?? 1.5,
        sgstPercent: bill.sgstPercent ?? 1.5,

        payments: loadedPayments,

        soldBy: bill.soldBy || "",
        notes: bill.notes || "",
        photo: bill.photo?.url
          ? { url: bill.photo.url, publicId: bill.photo.publicId }
          : null,
        customerPhoto: bill.customerPhoto?.url
          ? { url: bill.customerPhoto.url, publicId: bill.customerPhoto.publicId }
          : null,
      });

      // On phones, start loaded bills collapsed so the page isn't endless.
      if (isMobileScreen()) {
        const next = {};
        loadedItems.forEach((x) => (next[`item_${x.id}`] = true));
        loadedExchange.forEach((x) => (next[`ex_${x.id}`] = true));
        loadedPayments.forEach((x) => (next[`pay_${x.id}`] = true));
        setCollapsed(next);
      } else {
        setCollapsed({});
      }

      setLoadedBillId(bill._id);
      setHelperKey((k) => k + 1);
      setErrors({});
      setSearchMessage({
        type: "success",
        text: `Bill ${bill.billNo} loaded. Publishing will update this bill.`,
      });
    } catch (err) {
      console.error("Bill search failed:", err);
      setSearchMessage({
        type: "error",
        text: err.message || "Something went wrong while searching.",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearBill = () => {
    setLoadedBillId(null);
    setSearchMessage({ type: "", text: "" });
    setErrors({});
    setCollapsed({});
    setHelperKey((k) => k + 1);
    setFormData(emptyForm());
  };

  // =========================================================
  // HANDLE NORMAL FIELD
  // =========================================================

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // =========================================================
  // ITEM CALCULATIONS
  // Mirrors the backend's pre("validate") hook exactly, so the
  // numbers shown here match what gets saved.
  // =========================================================

  const calculateItemAmount = (item) => {
    const netWeight = Number(item.netWeight || 0);
    const ratePerGram = Number(item.ratePerGram || 0);
    const wastagePercent = Number(item.wastagePercent || 0);
    const makingCharge = Number(item.makingCharge || 0);
    const stoneCharge = Number(item.stoneCharge || 0);
    const quantity = Number(item.quantity || 1);

    const metalValue = netWeight * ratePerGram;
    const wastageValue = metalValue * (wastagePercent / 100);

    let makingValue = 0;
    if (item.makingChargeType === "flat") makingValue = makingCharge;
    else if (item.makingChargeType === "perGram") makingValue = makingCharge * netWeight;
    else if (item.makingChargeType === "percentage") makingValue = metalValue * (makingCharge / 100);

    return (metalValue + wastageValue + makingValue + stoneCharge) * quantity;
  };

  const calculateExchangeAmount = (ex) => {
    const netWeight = Number(ex.netWeight || 0);
    const ratePerGram = Number(ex.ratePerGram || 0);
    return netWeight * ratePerGram;
  };

  const isSimple = formData.billType === "simple";

  const itemAmounts = formData.items.map(calculateItemAmount);
  const exchangeAmounts = formData.exchangeItems.map(calculateExchangeAmount);

  const itemsSubtotal = isSimple
    ? Number(formData.simpleAmount || 0)
    : itemAmounts.reduce((sum, a) => sum + a, 0);
  const exchangeTotal = isSimple
    ? 0
    : exchangeAmounts.reduce((sum, a) => sum + a, 0);

  const discountValue = isSimple ? 0 : Number(formData.discount || 0);
  const taxableAmount = Math.max(itemsSubtotal - discountValue, 0);

  const cgstAmount = isSimple ? 0 : taxableAmount * (Number(formData.cgstPercent || 0) / 100);
  const sgstAmount = isSimple ? 0 : taxableAmount * (Number(formData.sgstPercent || 0) / 100);

  const preRound = taxableAmount + cgstAmount + sgstAmount - exchangeTotal;
  const grandTotal = Math.max(Math.round(preRound), 0);
  const roundOff = grandTotal - preRound;
  const exchangeExceedsBill = !isSimple && preRound < -0.5;

  // Total paid = sum of every recorded payment (each with its own date)
  const amountPaidValue = formData.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );
  const balanceDue = Math.max(grandTotal - amountPaidValue, 0);

  // =========================================================
  // ADD / REMOVE / UPDATE ITEM
  // =========================================================

  const addItem = () => {
    if (formData.items.length >= 100) {
      alert("Maximum 100 items are allowed on a single bill.");
      return;
    }

    // On phones, fold the existing cards so the new one is the only open card.
    if (isMobileScreen()) {
      setCollapsed((prev) => {
        const next = { ...prev };
        formData.items.forEach((it) => (next[`item_${it.id}`] = true));
        return next;
      });
    }

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: makeId(),
          itemName: "",
          category: "gold",
          huid: "",
          purity: "",
          hsnCode: "",
          grossWeight: "",
          stoneWeight: "",
          netWeight: "",
          ratePerGram: "",
          makingChargeType: "perGram",
          makingCharge: "",
          wastagePercent: "",
          stoneCharge: "",
          quantity: 1,
        },
      ],
    }));
  };

  const removeItem = (id) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  };

  const updateItem = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Keep netWeight in sync with gross/stone weight unless the
        // user is directly editing netWeight itself.
        if (field === "grossWeight" || field === "stoneWeight") {
          const gross = Number(field === "grossWeight" ? value : item.grossWeight || 0);
          const stone = Number(field === "stoneWeight" ? value : item.stoneWeight || 0);
          updated.netWeight = String(Math.max(gross - stone, 0));
        }

        return updated;
      }),
    }));
  };

  // =========================================================
  // ADD / REMOVE / UPDATE EXCHANGE ITEM
  // =========================================================

  const addExchangeItem = () => {
    if (isMobileScreen()) {
      setCollapsed((prev) => {
        const next = { ...prev };
        formData.exchangeItems.forEach((ex) => (next[`ex_${ex.id}`] = true));
        return next;
      });
    }

    setFormData((prev) => ({
      ...prev,
      exchangeItems: [
        ...prev.exchangeItems,
        {
          id: makeId(),
          description: "",
          category: "gold",
          grossWeight: "",
          purity: "",
          deduction: "",
          netWeight: "",
          ratePerGram: "",
        },
      ],
    }));
  };

  const removeExchangeItem = (id) => {
    setFormData((prev) => ({
      ...prev,
      exchangeItems: prev.exchangeItems.filter((ex) => ex.id !== id),
    }));
  };

  const updateExchangeItem = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      exchangeItems: prev.exchangeItems.map((ex) => {
        if (ex.id !== id) return ex;

        const updated = { ...ex, [field]: value };

        if (field === "grossWeight" || field === "deduction") {
          const gross = Number(field === "grossWeight" ? value : ex.grossWeight || 0);
          const deduction = Number(field === "deduction" ? value : ex.deduction || 0);
          updated.netWeight = String(Math.max(gross - deduction, 0));
        }

        return updated;
      }),
    }));
  };

  // =========================================================
  // ADD / REMOVE / UPDATE PAYMENT
  // Each payment is its own record: date + amount + mode.
  // =========================================================

  const addPayment = () => {
    if (isMobileScreen()) {
      setCollapsed((prev) => {
        const next = { ...prev };
        formData.payments.forEach((p) => (next[`pay_${p.id}`] = true));
        return next;
      });
    }

    setFormData((prev) => ({
      ...prev,
      payments: [
        ...prev.payments,
        {
          id: makeId(),
          date: getToday(),
          amount: "",
          mode: "cash",
        },
      ],
    }));
  };

  const removePayment = (id) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.filter((payment) => payment.id !== id),
    }));
  };

  const updatePayment = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.map((payment) =>
        payment.id === id ? { ...payment, [field]: value } : payment
      ),
    }));
  };

  // =========================================================
  // SCROLL / FOCUS TO FIRST INVALID FIELD
  // Cards that contain an error are expanded first, then we scroll.
  // =========================================================

  const expandCardsWithErrors = (errs) => {
    const open = {};

    Object.keys(errs).forEach((key) => {
      if (!errs[key]) return;

      const idx = Number(key.split("_")[1]);
      if (Number.isNaN(idx)) return;

      if (key.startsWith("item")) {
        const it = formData.items[idx];
        if (it) open[`item_${it.id}`] = false;
      } else if (key.startsWith("exchange")) {
        const ex = formData.exchangeItems[idx];
        if (ex) open[`ex_${ex.id}`] = false;
      } else if (key.startsWith("payment")) {
        const p = formData.payments[idx];
        if (p) open[`pay_${p.id}`] = false;
      }
    });

    if (Object.keys(open).length > 0) {
      setCollapsed((prev) => ({ ...prev, ...open }));
    }
  };

  const scrollToFirstError = (errs) => {
    const errorKeys = Object.keys(errs).filter((k) => errs[k]);

    if (errorKeys.length === 0) return;

    const firstErrorKey = errorKeys[0];

    // Wait a moment so collapsed cards have time to open.
    window.setTimeout(() => {
      const node = fieldRefs.current[firstErrorKey];

      if (!node) return;

      node.scrollIntoView({ behavior: "smooth", block: "center" });

      window.setTimeout(() => {
        if (typeof node.focus === "function") {
          node.focus({ preventScroll: true });
        }
      }, 350);
    }, 120);
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    const errs = {};

    if (!formData.customerName.trim()) {
      errs.customerName = "Customer name is required.";
    }

    if (wordCount(formData.customerName) > 60) {
      errs.customerName = "Customer name must be 60 words or fewer.";
    }

    if (!/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = "Mobile No. must be exactly 10 digits.";
    }

    if (formData.address && wordCount(formData.address) > 100) {
      errs.address = "Address must be 100 words or fewer.";
    }

    if (!formData.billDate) {
      errs.billDate = "Bill date is required.";
    }

    if (isSimple) {
      if (!formData.description.trim()) {
        errs.description = "Description is required.";
      } else if (wordCount(formData.description) > 500) {
        errs.description = "Description must be 500 words or fewer.";
      }

      if (formData.simpleAmount === "" || Number(formData.simpleAmount) <= 0) {
        errs.simpleAmount = "Enter a valid amount.";
      }
    } else {
      if (formData.items.length === 0) {
        errs.items = "Add at least one item to the bill.";
      }

      formData.items.forEach((item, index) => {
        if (!String(item.itemName || "").trim()) {
          errs[`itemName_${index}`] = `Item name is required for Item ${index + 1}.`;
        }

        if (item.grossWeight === "" || Number(item.grossWeight) < 0) {
          errs[`itemGrossWeight_${index}`] = `Enter a valid gross weight for Item ${index + 1}.`;
        }

        if (item.ratePerGram === "" || Number(item.ratePerGram) < 0) {
          errs[`itemRate_${index}`] = `Enter a valid rate for Item ${index + 1}.`;
        }
      });

      formData.exchangeItems.forEach((ex, index) => {
        if (ex.grossWeight === "" || Number(ex.grossWeight) < 0) {
          errs[`exchangeWeight_${index}`] = `Enter a valid gross weight for Exchange ${index + 1}.`;
        }

        if (ex.ratePerGram === "" || Number(ex.ratePerGram) < 0) {
          errs[`exchangeRate_${index}`] = `Enter a valid rate for Exchange ${index + 1}.`;
        }
      });
    }

    if (formData.discount !== "" && Number(formData.discount) < 0) {
      errs.discount = "Discount cannot be negative.";
    }

    formData.payments.forEach((payment, index) => {
      if (payment.amount !== "" && Number(payment.amount) < 0) {
        errs[`paymentAmount_${index}`] = `Payment ${index + 1} amount cannot be negative.`;
      }

      if (Number(payment.amount) > 0 && !payment.date) {
        errs[`paymentDate_${index}`] = `Payment ${index + 1} needs a date.`;
      }
    });

    // Compare in paise so tiny float differences don't cause false errors
    if (Math.round(amountPaidValue * 100) > Math.round(grandTotal * 100)) {
      errs.payments = `Total amount paid cannot exceed the grand total of ₹${grandTotal.toFixed(2)}.`;
    }

    if (formData.notes && wordCount(formData.notes) > 300) {
      errs.notes = "Notes must be 300 words or fewer.";
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      expandCardsWithErrors(errs);
      scrollToFirstError(errs);
    }

    return Object.keys(errs).length === 0;
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit = (e) => {
    e.preventDefault();

    if (uploading) {
      alert("Photo is still uploading. Please wait a moment.");
      return;
    }

    if (!validate()) {
      return;
    }

    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    setShowConfirm(false);

    if (!user?.token) {
      alert("Session expired. Please log in again.");
      return;
    }

    setLoading(true);

    try {
      const cleanedItems = formData.items.map((item) => ({
        itemName: item.itemName,
        category: item.category,
        huid: item.huid,
        purity: item.purity,
        hsnCode: item.hsnCode,
        grossWeight: Number(item.grossWeight || 0),
        stoneWeight: Number(item.stoneWeight || 0),
        netWeight: Number(item.netWeight || 0),
        ratePerGram: Number(item.ratePerGram || 0),
        makingChargeType: item.makingChargeType,
        makingCharge: Number(item.makingCharge || 0),
        wastagePercent: Number(item.wastagePercent || 0),
        stoneCharge: Number(item.stoneCharge || 0),
        quantity: Number(item.quantity || 1),
      }));

      const cleanedExchangeItems = formData.exchangeItems.map((ex) => ({
        description: ex.description,
        category: ex.category,
        grossWeight: Number(ex.grossWeight || 0),
        purity: ex.purity,
        deduction: Number(ex.deduction || 0),
        netWeight: Number(ex.netWeight || 0),
        ratePerGram: Number(ex.ratePerGram || 0),
      }));

      // Drop blank rows (a payment row left at "" is just an unused
      // slot in the UI, not an actual payment) and normalize types.
      const cleanedPayments = formData.payments
        .filter((payment) => payment.amount !== "" && Number(payment.amount) > 0)
        .map((payment) => ({
          date: payment.date || getToday(),
          amount: Number(payment.amount),
          mode: payment.mode,
        }));

      const distinctModes = [
        ...new Set(cleanedPayments.map((payment) => payment.mode)),
      ];

      // Kept for backward compatibility with any code still reading a
      // single top-level paymentMode/amountPaid off the bill.
      const primaryPaymentMode =
        distinctModes.length === 0
          ? "cash"
          : distinctModes.length === 1
          ? distinctModes[0]
          : "mixed";

      const submitData = {
        ...(String(formData.billNo || "").trim()
          ? { billNo: String(formData.billNo).trim() }
          : {}),
        ...(selectedPerson?._id ? { personId: selectedPerson._id } : {}),
        billDate: formData.billDate,
        billType: formData.billType,
        description: isSimple ? formData.description.trim() : undefined,
        simpleAmount: isSimple ? Number(formData.simpleAmount || 0) : 0,
        customerName: formData.customerName,
        mobileNo: String(formData.mobileNo || "").trim(),
        address: formData.address,
        gstin: isSimple ? "" : formData.gstin,
        items: isSimple ? [] : cleanedItems,
        exchangeItems: isSimple ? [] : cleanedExchangeItems,
        discount: isSimple ? 0 : Number(formData.discount || 0),
        cgstPercent: isSimple ? 0 : Number(formData.cgstPercent || 0),
        sgstPercent: isSimple ? 0 : Number(formData.sgstPercent || 0),
        payments: cleanedPayments,
        amountPaid: cleanedPayments.reduce((sum, payment) => sum + payment.amount, 0),
        paymentMode: primaryPaymentMode,
        soldBy: formData.soldBy,
        notes: formData.notes,
        photo: formData.photo || null,
        customerPhoto: formData.customerPhoto || null,
      };

      const res = await fetch(
        loadedBillId ? `/api/bills/${loadedBillId}` : "/api/bills",
        {
          method: loadedBillId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify(submitData),
        },
      );

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check that the API server is running and the request URL/proxy is correct.`,
        );
      }

      const responseData = await res.json();

      if (res.ok) {
        alert(
          `Bill ${responseData.billNo || ""} ${
            loadedBillId ? "updated" : "created"
          } successfully!`,
        );
        navigate("/admin/bill/products");
      } else {
        alert(responseData.message || "Error creating bill");
      }
    } catch (error) {
      console.error("Error creating bill:", error);
      alert(error.message || "Something went wrong while creating the bill.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ADMIN CHECK (render guard - redirect happens in the effect above)
  // =========================================================

  if (!user || user.role !== "admin") {
    return null;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="bill-container">
      <h1
        style={{
          textAlign: "center",
          color: "#f97316",
          fontSize: "28px",
          fontWeight: "800",
          letterSpacing: "0.08em",
          margin: "0 0 20px",
        }}
      >
        BILL
      </h1>

      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "26px",
        }}
      >
        <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>
          {loadedBillId ? "Edit Bill" : "Create New Bill"}
        </h2>

        <button
          type="button"
          onClick={() => navigate("/admin/bill/products")}
          style={{
            padding: "10px 18px",
            borderRadius: "7px",
            border: "none",
            background: "#3f3f46",
            color: "#fff",
            fontSize: "13.5px",
            fontWeight: "600",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🧾 Manage Bills
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "18px" }}
      >
        {/* =====================================================
            BILL TYPE TOGGLE
        ====================================================== */}
        <div className="type-toggle" style={{ display: "flex", gap: "10px" }}>
          {[
            { value: "simple", label: "🧾 Simple Bill" },
            { value: "jewellery", label: "💍 Jewellery Bill" },
          ].map((opt) => {
            const active = formData.billType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={Boolean(loadedBillId)}
                onClick={() => handleChange("billType", opt.value)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "7px",
                  border: active ? "1px solid #f97316" : "1px solid #3f3f46",
                  background: active ? "rgba(249,115,22,0.15)" : "#09090b",
                  color: active ? "#f97316" : "#a1a1aa",
                  fontWeight: "600",
                  fontSize: "13.5px",
                  cursor: loadedBillId ? "not-allowed" : "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* =====================================================
            BILL NO + BILL DATE
        ====================================================== */}
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>
              Bill No. (leave blank to auto-generate)
            </label>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="e.g. INV0001"
                maxLength={15}
                readOnly={Boolean(loadedBillId)}
                value={formData.billNo}
                onChange={(e) => {
                  handleChange(
                    "billNo",
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 15),
                  );
                  if (searchMessage.text) {
                    setSearchMessage({ type: "", text: "" });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loadedBillId) {
                    e.preventDefault();
                    handleBillSearch();
                  }
                }}
                style={{ ...inputStyle, paddingRight: "48px" }}
              />

              {loadedBillId ? (
                <button
                  type="button"
                  onClick={handleClearBill}
                  title="Clear bill and search again"
                  className="search-icon-btn"
                  style={searchIconButtonStyle}
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBillSearch}
                  disabled={searchLoading}
                  title="Search bill by Bill No."
                  className="search-icon-btn"
                  style={{
                    ...searchIconButtonStyle,
                    color: searchLoading ? "#52525b" : "#f97316",
                    cursor: searchLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {searchLoading ? "…" : "🔍"}
                </button>
              )}
            </div>

            {searchMessage.text && (
              <p
                style={{
                  color: searchMessage.type === "success" ? "#22c55e" : "#ef4444",
                  fontSize: "0.8rem",
                  margin: "5px 0 0",
                }}
              >
                {searchMessage.text}
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Bill Date</label>

            <input
              type="date"
              required
              value={formData.billDate}
              onChange={(e) => handleChange("billDate", e.target.value)}
              ref={(el) => (fieldRefs.current.billDate = el)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />

            <FieldError msg={errors.billDate} />
          </div>
        </div>

        {/* =====================================================
            CUSTOMER DETAILS
        ====================================================== */}
        <div>
          <label style={labelStyle}>Customer Name</label>

          <input
            type="text"
            placeholder="Full name"
            required
            value={formData.customerName}
            onChange={(e) =>
              handleChange("customerName", e.target.value.toUpperCase())
            }
            ref={(el) => (fieldRefs.current.customerName = el)}
            style={inputStyle}
          />

          <FieldError msg={errors.customerName} />
        </div>

        <div className="three-col" style={isSimple ? twoColGridStyle : threeColGridStyle}>
          <div>
            <label style={smallLabelStyle}>Mobile No.</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              required
              maxLength={10}
              value={formData.mobileNo}
              onChange={(e) => handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))}
              ref={(el) => (fieldRefs.current.mobileNo = el)}
              style={inputStyle}
            />
            <FieldError msg={errors.mobileNo} />
          </div>

          <div>
            <label style={smallLabelStyle}>Address</label>
            <input
              type="text"
              placeholder="Address (optional)"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              ref={(el) => (fieldRefs.current.address = el)}
              style={inputStyle}
            />
            <FieldError msg={errors.address} />
          </div>

          {!isSimple && (
            <div>
              <label style={smallLabelStyle}>GSTIN (optional, for B2B)</label>
              <input
                type="text"
                placeholder="Customer GSTIN"
                maxLength={15}
                value={formData.gstin}
                onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* =====================================================
            SIMPLE BILL DETAILS
        ====================================================== */}
        {isSimple && (
          <SectionCard>
            <SectionHeader title="Bill Details" />

            <div style={{ display: "grid", gap: "16px" }}>
              <DescriptionHelper
                key={helperKey}
                defaultOpen={!loadedBillId}
                onApply={applyHelper}
              />

              <div>
                <label style={smallLabelStyle}>Description</label>
                <textarea
                  placeholder="What is this bill for?"
                  rows="6"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  ref={(el) => (fieldRefs.current.description = el)}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <FieldError msg={errors.description} />
              </div>

              <div className="amount-field" style={{ maxWidth: "360px" }}>
                <label style={smallLabelStyle}>Amount</label>
                <MoneyInput
                  placeholder="Amount"
                  value={formData.simpleAmount}
                  onChange={(e) => handleChange("simpleAmount", e.target.value)}
                  inputRef={(el) => (fieldRefs.current.simpleAmount = el)}
                />
                {formData.simpleAmount && (
                  <div style={amountWordsStyle}>
                    {numberToWords(formData.simpleAmount)}
                  </div>
                )}
                <FieldError msg={errors.simpleAmount} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* =====================================================
            JEWELLERY BILL SECTIONS
        ====================================================== */}
        {!isSimple && (
          <>
            {/* ---------------- ITEMS ---------------- */}
            <SectionCard>
              <div style={sectionTopRowStyle(16)}>
                <div>
                  <SectionHeader title="Items" marginBottom="2px" />
                  <div style={{ color: "#71717a", fontSize: "12.5px" }}>
                    {formData.items.length}/100 added
                  </div>
                </div>

                <AddButton onClick={addItem} text="+ Add Item" />
              </div>

              {errors.items && <SmallError msg={errors.items} />}

              {formData.items.map((item, index) => {
                const amount = itemAmounts[index];
                const key = `item_${item.id}`;
                const isCollapsed = Boolean(collapsed[key]);

                return (
                  <div key={item.id} className="row-card" style={rowCardStyle}>
                    <CardHeader
                      title={`Item ${index + 1}`}
                      summary={`${item.itemName || "Unnamed"} · ₹${amount.toFixed(2)}`}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleCollapse(key)}
                      onDelete={() => removeItem(item.id)}
                      deleteTitle="Remove item"
                    />

                    <div style={{ display: isCollapsed ? "none" : "block" }}>
                      <div className="item-grid" style={itemGridStyle}>
                        <div className="full-mobile">
                          <label style={smallLabelStyle}>Item Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Gold Necklace"
                            value={item.itemName}
                            onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                            ref={(el) => (fieldRefs.current[`itemName_${index}`] = el)}
                            style={inputStyle}
                          />
                          <SmallError msg={errors[`itemName_${index}`]} />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Category</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateItem(item.id, "category", e.target.value)}
                            style={{ ...inputStyle, cursor: "pointer" }}
                          >
                            <option value="gold">Gold</option>
                            <option value="silver">Silver</option>
                            <option value="diamond">Diamond</option>
                            <option value="platinum">Platinum</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Purity</label>
                          <input
                            type="text"
                            placeholder="e.g. 22K / 916"
                            value={item.purity}
                            onChange={(e) => updateItem(item.id, "purity", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>HUID</label>
                          <input
                            type="text"
                            placeholder="Hallmark ID"
                            maxLength={6}
                            value={item.huid}
                            onChange={(e) => updateItem(item.id, "huid", e.target.value.toUpperCase())}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Gross Wt. (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.grossWeight}
                            onChange={(e) => updateItem(item.id, "grossWeight", e.target.value)}
                            ref={(el) => (fieldRefs.current[`itemGrossWeight_${index}`] = el)}
                            style={inputStyle}
                          />
                          <SmallError msg={errors[`itemGrossWeight_${index}`]} />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Stone Wt. (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.stoneWeight}
                            onChange={(e) => updateItem(item.id, "stoneWeight", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Net Wt. (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.netWeight}
                            onChange={(e) => updateItem(item.id, "netWeight", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Rate / gram</label>
                          <MoneyInput
                            placeholder="Rate"
                            value={item.ratePerGram}
                            onChange={(e) => updateItem(item.id, "ratePerGram", e.target.value)}
                            inputRef={(el) => (fieldRefs.current[`itemRate_${index}`] = el)}
                            compact
                          />
                          <SmallError msg={errors[`itemRate_${index}`]} />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Making Charge Type</label>
                          <select
                            value={item.makingChargeType}
                            onChange={(e) => updateItem(item.id, "makingChargeType", e.target.value)}
                            style={{ ...inputStyle, cursor: "pointer" }}
                          >
                            <option value="perGram">Per Gram</option>
                            <option value="flat">Flat</option>
                            <option value="percentage">Percentage</option>
                          </select>
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Making Charge</label>
                          <MoneyInput
                            placeholder="Making charge"
                            value={item.makingCharge}
                            onChange={(e) => updateItem(item.id, "makingCharge", e.target.value)}
                            compact
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Wastage (%)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.wastagePercent}
                            onChange={(e) => updateItem(item.id, "wastagePercent", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Stone Charge</label>
                          <MoneyInput
                            placeholder="Stone charge"
                            value={item.stoneCharge}
                            onChange={(e) => updateItem(item.id, "stoneCharge", e.target.value)}
                            compact
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Qty</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "10px",
                          textAlign: "right",
                          color: "#22c55e",
                          fontSize: "14px",
                          fontWeight: "700",
                        }}
                      >
                        Line Amount: ₹{amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {formData.items.length === 0 && (
                <div style={emptyStyle}>No items added</div>
              )}

              {formData.items.length > 0 && (
                <div style={subTotalStyle}>
                  <span>
                    Items Subtotal: <b style={{ color: "#22c55e" }}>₹{itemsSubtotal.toFixed(2)}</b>
                  </span>
                </div>
              )}
            </SectionCard>

            {/* ---------------- EXCHANGE ---------------- */}
            <SectionCard>
              <div style={sectionTopRowStyle(formData.exchangeItems.length ? 16 : 0)}>
                <div>
                  <SectionHeader title="Old Gold / Silver Exchange (optional)" marginBottom="2px" />
                  <div style={{ color: "#71717a", fontSize: "12.5px" }}>
                    {formData.exchangeItems.length} added
                  </div>
                </div>

                <AddButton onClick={addExchangeItem} text="+ Add Exchange Item" />
              </div>

              {formData.exchangeItems.map((ex, index) => {
                const amount = exchangeAmounts[index];
                const key = `ex_${ex.id}`;
                const isCollapsed = Boolean(collapsed[key]);

                return (
                  <div key={ex.id} className="row-card" style={rowCardStyle}>
                    <CardHeader
                      title={`Exchange ${index + 1}`}
                      summary={`${ex.description || "Unnamed"} · -₹${amount.toFixed(2)}`}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleCollapse(key)}
                      onDelete={() => removeExchangeItem(ex.id)}
                      deleteTitle="Remove exchange item"
                    />

                    <div style={{ display: isCollapsed ? "none" : "block" }}>
                      <div className="exchange-grid" style={exchangeGridStyle}>
                        <div className="full-mobile">
                          <label style={smallLabelStyle}>Description</label>
                          <input
                            type="text"
                            placeholder="e.g. Old gold chain"
                            value={ex.description}
                            onChange={(e) => updateExchangeItem(ex.id, "description", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Category</label>
                          <select
                            value={ex.category}
                            onChange={(e) => updateExchangeItem(ex.id, "category", e.target.value)}
                            style={{ ...inputStyle, cursor: "pointer" }}
                          >
                            <option value="gold">Gold</option>
                            <option value="silver">Silver</option>
                          </select>
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Purity</label>
                          <input
                            type="text"
                            placeholder="e.g. 22K"
                            value={ex.purity}
                            onChange={(e) => updateExchangeItem(ex.id, "purity", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Gross Wt. (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ex.grossWeight}
                            onChange={(e) => updateExchangeItem(ex.id, "grossWeight", e.target.value)}
                            ref={(el) => (fieldRefs.current[`exchangeWeight_${index}`] = el)}
                            style={inputStyle}
                          />
                          <SmallError msg={errors[`exchangeWeight_${index}`]} />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Deduction (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ex.deduction}
                            onChange={(e) => updateExchangeItem(ex.id, "deduction", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Net Wt. (g)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={ex.netWeight}
                            onChange={(e) => updateExchangeItem(ex.id, "netWeight", e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={smallLabelStyle}>Rate / gram</label>
                          <MoneyInput
                            placeholder="Rate"
                            value={ex.ratePerGram}
                            onChange={(e) => updateExchangeItem(ex.id, "ratePerGram", e.target.value)}
                            inputRef={(el) => (fieldRefs.current[`exchangeRate_${index}`] = el)}
                            compact
                          />
                          <SmallError msg={errors[`exchangeRate_${index}`]} />
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "8px",
                          textAlign: "right",
                          color: "#ef4444",
                          fontSize: "14px",
                          fontWeight: "700",
                        }}
                      >
                        Exchange Value: -₹{amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {formData.exchangeItems.length === 0 && (
                <div style={emptyStyle}>No exchange items added</div>
              )}

              {formData.exchangeItems.length > 0 && (
                <div style={subTotalStyle}>
                  <span>
                    Exchange Total: <b style={{ color: "#ef4444" }}>-₹{exchangeTotal.toFixed(2)}</b>
                  </span>
                </div>
              )}
            </SectionCard>

            {/* ---------------- DISCOUNT / TAX ---------------- */}
            <SectionCard>
              <SectionHeader title="Discount & Tax" />

              <div className="three-col" style={threeColGridStyle}>
                <div>
                  <label style={smallLabelStyle}>Discount</label>
                  <MoneyInput
                    placeholder="Discount"
                    value={formData.discount}
                    onChange={(e) => handleChange("discount", e.target.value)}
                    inputRef={(el) => (fieldRefs.current.discount = el)}
                  />
                  <FieldError msg={errors.discount} />
                </div>

                <div>
                  <label style={smallLabelStyle}>CGST (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.cgstPercent}
                    onChange={(e) => handleChange("cgstPercent", e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={smallLabelStyle}>SGST (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.sgstPercent}
                    onChange={(e) => handleChange("sgstPercent", e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* =====================================================
            PAYMENTS (full history: each payment has its own date)
        ====================================================== */}
        <SectionCard>
          <div style={sectionTopRowStyle(16)}>
            <div>
              <SectionHeader title="Payments" marginBottom="2px" />
              <div style={{ color: "#71717a", fontSize: "12.5px" }}>
                {formData.payments.length} recorded
              </div>
            </div>

            <AddButton onClick={addPayment} text="+ Add Payment" />
          </div>

          {errors.payments && <SmallError msg={errors.payments} />}

          {formData.payments.map((payment, index) => {
            const key = `pay_${payment.id}`;
            const isCollapsed = Boolean(collapsed[key]);
            const modeLabel = String(payment.mode || "").replace(/_/g, " ");

            return (
              <div
                key={payment.id}
                className="row-card pay-row"
                style={{
                  ...rowCardStyle,
                  borderBottom:
                    index === formData.payments.length - 1
                      ? "none"
                      : "1px solid #1f1f23",
                }}
              >
                <CardHeader
                  title={`Payment ${index + 1}`}
                  summary={`${formatDisplayDate(payment.date)} · ₹${Number(payment.amount || 0).toFixed(2)} · ${modeLabel}`}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleCollapse(key)}
                  onDelete={() => removePayment(payment.id)}
                  deleteTitle="Remove payment"
                />

                <div style={{ display: isCollapsed ? "none" : "block" }}>
                  <div className="payment-grid" style={paymentGridStyle}>
                    <div>
                      <label className="pay-label" style={smallLabelStyle}>Date</label>
                      <input
                        type="date"
                        aria-label="Payment date"
                        value={payment.date}
                        onChange={(e) => updatePayment(payment.id, "date", e.target.value)}
                        ref={(el) => (fieldRefs.current[`paymentDate_${index}`] = el)}
                        style={{ ...inputStyle, cursor: "pointer" }}
                      />
                      <SmallError msg={errors[`paymentDate_${index}`]} />
                    </div>

                    <div>
                      <label className="pay-label" style={smallLabelStyle}>Amount</label>
                      <MoneyInput
                        placeholder="Amount"
                        value={payment.amount}
                        onChange={(e) => updatePayment(payment.id, "amount", e.target.value)}
                        inputRef={(el) => (fieldRefs.current[`paymentAmount_${index}`] = el)}
                        compact
                      />
                      <SmallError msg={errors[`paymentAmount_${index}`]} />
                    </div>

                    <div>
                      <label className="pay-label" style={smallLabelStyle}>Mode</label>
                      <select
                        aria-label="Payment mode"
                        value={payment.mode}
                        onChange={(e) => updatePayment(payment.id, "mode", e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer" }}
                      >
                        <option value="cash">Cash</option>
                        <option value="old_gold">Purana Sona</option>
                        <option value="old_silver">Purana Chandi</option>
                        <option value="card">Card</option>
                        <option value="upi">UPI</option>
                        <option value="cheque">Cheque</option>
                        <option value="bank_transfer">Bank</option>
                      </select>
                    </div>
                  </div>

                  {payment.amount && (
                    <div className="pay-words" style={amountWordsStyle}>
                      {numberToWords(payment.amount)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {formData.payments.length === 0 && (
            <div style={emptyStyle}>No payments recorded</div>
          )}

          {formData.payments.length > 0 && (
            <div style={subTotalStyle}>
              <span>
                Total Paid: <b style={{ color: "#22c55e" }}>₹{amountPaidValue.toFixed(2)}</b>
              </span>
            </div>
          )}
        </SectionCard>

        {/* =====================================================
            FINAL SUMMARY
        ====================================================== */}
        <div
          className="section-card"
          style={{
            padding: "20px",
            background: "#111113",
            border: "1px solid #3f3f46",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              color: "#f97316",
              fontSize: "15px",
              fontWeight: "600",
              marginBottom: "14px",
            }}
          >
            Final Bill Summary
          </div>

          <div
            className="summary-grid"
            style={{
              display: "grid",
              gridTemplateColumns: isSimple
                ? "repeat(2, minmax(130px, 1fr))"
                : "repeat(6, minmax(130px, 1fr))",
              gap: "12px",
            }}
          >
            <SummaryBox label="Items Subtotal" value={itemsSubtotal} />

            {!isSimple && (
              <>
                <SummaryBox className="hide-mobile" label="Exchange Total" value={exchangeTotal} color="#ef4444" />
                <SummaryBox className="hide-mobile" label="Taxable Amount" value={taxableAmount} />
                <SummaryBox className="hide-mobile" label="CGST + SGST" value={cgstAmount + sgstAmount} color="#f59e0b" />
                <SummaryBox className="hide-mobile" label="Round Off" value={roundOff} color="#71717a" />
              </>
            )}

            <SummaryBox
              className="grand"
              label="GRAND TOTAL"
              value={grandTotal}
              color="#22c55e"
              large
            />
          </div>

          {exchangeExceedsBill && (
            <div style={{ marginTop: "10px", color: "#f59e0b", fontSize: "12.5px" }}>
              ⚠ Exchange value is higher than the bill total by ₹
              {Math.abs(preRound).toFixed(2)}. The grand total is shown as ₹0 —
              the customer would be owed this difference.
            </div>
          )}

          {grandTotal > 0 && (
            <div style={{ marginTop: "10px", color: "#71717a", fontSize: "12.5px" }}>
              {numberToWords(grandTotal)}
            </div>
          )}

          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid #27272a",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              fontSize: "13px",
              color: "#a1a1aa",
            }}
          >
            <span>
              Amount Paid: <b style={{ color: "#22c55e" }}>₹{amountPaidValue.toFixed(2)}</b>
            </span>
            <span>
              Balance Due: <b style={{ color: "#ef4444" }}>₹{balanceDue.toFixed(2)}</b>
            </span>
          </div>
        </div>

        {/* =====================================================
            SOLD BY / NOTES
        ====================================================== */}
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Sold By</label>
            <input
              type="text"
              placeholder="Staff name (optional)"
              value={formData.soldBy}
              onChange={(e) => handleChange("soldBy", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            placeholder="Any additional notes (optional)"
            rows="3"
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            ref={(el) => (fieldRefs.current.notes = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <FieldError msg={errors.notes} />
        </div>

        {/* =====================================================
            BILL PHOTO
        ====================================================== */}
        <SectionCard>
          <SectionHeader title="Customer Photo (optional)" />
          <BillPhotoUpload
            value={formData.customerPhoto}
            onChange={(photo) => handleChange("customerPhoto", photo)}
            onBusyChange={setCustomerPhotoBusy}
            label="Customer"
          />
        </SectionCard>

        <SectionCard>
          <SectionHeader title="Bill Photo (optional)" />
          <BillPhotoUpload
            value={formData.photo}
            onChange={(photo) => handleChange("photo", photo)}
            onBusyChange={setPhotoBusy}
          />
        </SectionCard>

        {/* =====================================================
            SUBMIT
        ====================================================== */}
        <button
          type="submit"
          className="submit-btn"
          disabled={loading || uploading}
          style={{
            marginTop: "8px",
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: loading || uploading ? "#52525b" : "#f97316",
            color: "#fff",
            cursor: loading || uploading ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "15px",
          }}
        >
          {loading
            ? "Saving..."
            : uploading
            ? "Uploading photo..."
            : loadedBillId
            ? "Update Bill"
            : "Publish Bill"}
        </button>
      </form>

      {/* =====================================================
          CONFIRM PUBLISH MODAL
      ====================================================== */}

      {showConfirm && (
        <ConfirmPublishModal
          customerName={formData.customerName}
          mobileNo={formData.mobileNo}
          billDate={formData.billDate}
          grandTotal={grandTotal}
          amountPaid={amountPaidValue}
          balanceDue={balanceDue}
          loading={loading}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmSubmit}
        />
      )}

      {/* =====================================================
          RESPONSIVE CSS
      ====================================================== */}

      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.7;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #f97316 !important;
        }

        .bill-container {
          max-width: 1360px;
          margin: 30px auto;
          padding: 36px 40px;
          background: #18181b;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.05);
          box-sizing: border-box;
        }

        .card-toggle:focus-visible,
        .bill-container button:focus-visible {
          outline: 2px solid #f97316;
          outline-offset: 2px;
        }

        /* ---------- Description helper ---------- */
        .helper-add {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .helper-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .helper-full { grid-column: 1 / -1; }

        .helper-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        /* ---------- Tablet ---------- */
        @media (max-width: 1100px) {
          .bill-container { padding: 28px 24px; }

          .summary-grid {
            grid-template-columns: repeat(3, minmax(120px, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .two-col,
          .three-col {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .item-grid,
          .exchange-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
          }

          .payment-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        /* ---------- Mobile ---------- */
        @media (max-width: 640px) {
          .bill-container {
            margin: 0;
            padding: 12px 10px 110px; /* bottom space for the sticky submit button */
            background: transparent;
            border: none;
            border-radius: 0;
            min-height: 100vh;
          }

          /* the big "BILL" title repeats the page title below it */
          .bill-container h1 { display: none; }
          .bill-container h2 { font-size: 18px !important; }

          .page-header {
            flex-wrap: nowrap !important;
            align-items: center !important;
            margin-bottom: 14px !important;
          }
          .page-header button {
            width: auto;
            padding: 0 12px !important;
            min-height: 38px !important;
            font-size: 12.5px !important;
          }

          .type-toggle button {
            flex: 1;
            padding: 12px 8px !important;
          }

          /* 16px stops iOS Safari zooming on focus; 44px is a comfortable tap target */
          .bill-container input,
          .bill-container select,
          .bill-container textarea {
            font-size: 16px !important;
            min-height: 44px;
          }
          .bill-container textarea { min-height: 0; }

          /* iOS date fields can render wider/taller than other inputs */
          .bill-container input[type="date"] {
            min-width: 0;
            max-width: 100%;
            text-align: left;
          }

          .bill-container button { min-height: 44px; }
          .bill-container .search-icon-btn { min-height: 36px; }

          /* cards stand out from the page */
          .section-card {
            padding: 12px !important;
            background: #18181b !important;
            border: 1px solid #2f2f35 !important;
            border-radius: 12px !important;
          }

          /* each item / exchange / payment is its own boxed card */
          .row-card {
            background: #111113;
            border: 1px solid #2f2f35 !important;
            border-radius: 10px;
            padding: 10px !important;
            margin-bottom: 10px !important;
          }

          .amount-field { max-width: 100% !important; }

          .item-grid,
          .exchange-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .full-mobile { grid-column: 1 / -1; }

          /* Description helper on phones */
          .helper-add {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .helper-add button { width: 100%; padding: 10px 6px !important; }

          .helper-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .helper-actions { flex-direction: column; }

          /* Payment: date | amount | mode on ONE row */
          .payment-grid {
            grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr) !important;
            gap: 6px !important;
          }
          .payment-grid .pay-label { display: none; }
          .payment-grid input[type="date"],
          .payment-grid select {
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
          .payment-grid input[type="date"]::-webkit-calendar-picker-indicator {
            display: none;
          }
          .pay-words { display: none; }
          .pay-row {
            padding: 8px !important;
            margin-bottom: 8px !important;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          .summary-grid .grand { grid-column: 1 / -1; }

          .hide-mobile { display: none !important; }

          .submit-btn {
            position: fixed !important;
            left: 12px;
            right: 12px;
            bottom: 12px;
            z-index: 50;
            margin: 0 !important;
            min-height: 50px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
          }

          .modal-card {
            max-height: 90vh;
            overflow-y: auto;
            padding: 18px !important;
          }

          .modal-actions { flex-direction: column-reverse; }
        }

        /* ---------- Very small phones ---------- */
        @media (max-width: 360px) {
          .item-grid,
          .exchange-grid {
            grid-template-columns: 1fr !important;
          }
          .payment-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .payment-grid > div:first-child { grid-column: 1 / -1; }
        }
      `}</style>
    </div>
  );
};

// =========================================================
// COMPONENTS
// =========================================================

// Builder that turns gold / silver / old metal / discount rows into a
// ready description and a total amount. Rows are UI-only state; only the
// generated text and total are pushed into the form via onApply.
const DescriptionHelper = ({ onApply, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [lines, setLines] = useState([]);

  const addLine = (type) => {
    if (lines.length >= MAX_HELPER_LINES) {
      alert(`Maximum ${MAX_HELPER_LINES} rows are allowed.`);
      return;
    }
    setLines((prev) => [...prev, newLine(type)]);
  };

  const removeLine = (id) =>
    setLines((prev) => prev.filter((line) => line.id !== id));

  const updateLine = (id, field, value) =>
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );

  const { text, additions, deductions, total } = buildDescription(lines);

  // Numbering per type (Gold 1, Gold 2, Silver 1 ...)
  const typeCounters = {};

  return (
    <div
      style={{
        border: "1px solid #3f3f46",
        borderRadius: "10px",
        background: "#09090b",
        padding: "12px",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>
          <span style={{ color: "#f97316", fontSize: "14px", fontWeight: "700" }}>
            ✨ Description Helper
          </span>
          <span style={{ display: "block", color: "#71717a", fontSize: "12px", marginTop: "2px" }}>
            Add gold, silver, old metal and discount rows - the description and
            amount are written for you.
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: "#f97316",
            fontSize: "12px",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>
      </button>

      {open && (
        <div style={{ marginTop: "12px" }}>
          {/* ---------- add buttons ---------- */}
          <div className="helper-add">
            {Object.keys(LINE_TYPES).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addLine(type)}
                style={{
                  border: "1px solid #3f3f46",
                  background: LINE_TYPES[type].sign > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  color: LINE_TYPES[type].sign > 0 ? "#22c55e" : "#ef4444",
                  borderRadius: "7px",
                  padding: "9px 12px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                }}
              >
                + {LINE_TYPES[type].icon} {LINE_TYPES[type].label}
              </button>
            ))}
          </div>

          {/* ---------- rows ---------- */}
          <div style={{ marginTop: "12px" }}>
            {lines.map((line) => {
              typeCounters[line.type] = (typeCounters[line.type] || 0) + 1;
              const meta = LINE_TYPES[line.type];
              const c = computeLine(line);
              const fields = LINE_FIELDS[line.type];
              const isAddition = meta.sign > 0;

              return (
                <div
                  key={line.id}
                  className="row-card"
                  style={{
                    ...rowCardStyle,
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "10px",
                    background: "#111113",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={{ color: "#e4e4e7", fontSize: "13px", fontWeight: "700" }}>
                      {meta.icon} {meta.label}
                      {line.type !== "discount" || typeCounters[line.type] > 1
                        ? ` ${typeCounters[line.type]}`
                        : ""}
                    </span>

                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <b
                        style={{
                          color: isAddition ? "#22c55e" : "#ef4444",
                          fontSize: "13px",
                        }}
                      >
                        {isAddition ? "" : "-"}₹{money(c.total)}
                      </b>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        title="Remove row"
                        aria-label="Remove row"
                        style={{ ...deleteButtonStyle, minWidth: "44px" }}
                      >
                        🗑
                      </button>
                    </span>
                  </div>

                  <div className="helper-grid">
                    {fields.map((f) => (
                      <div key={f.key} className={f.kind === "text" ? "helper-full" : undefined}>
                        <label style={smallLabelStyle}>{f.label}</label>
                        {f.kind === "text" ? (
                          <input
                            type="text"
                            placeholder="e.g. Necklace, Ring, Payal"
                            value={line[f.key]}
                            onChange={(e) => updateLine(line.id, f.key, e.target.value)}
                            style={inputStyle}
                          />
                        ) : f.kind === "money" ? (
                          <MoneyInput
                            placeholder={f.label}
                            value={line[f.key]}
                            onChange={(e) => updateLine(line.id, f.key, e.target.value)}
                            compact
                          />
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={f.label}
                            value={line[f.key]}
                            onChange={(e) =>
                              updateLine(line.id, f.key, cleanDecimal(e.target.value))
                            }
                            style={inputStyle}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {(line.type === "gold" || line.type === "silver") && c.total > 0 && (
                    <div style={{ marginTop: "8px", color: "#71717a", fontSize: "12px" }}>
                      Metal ₹{money(c.metal)} + Making ₹{money(c.making)}
                    </div>
                  )}
                </div>
              );
            })}

            {lines.length === 0 && (
              <div style={emptyStyle}>
                Tap a button above to add a gold, silver, old metal or discount row
              </div>
            )}
          </div>

          {/* ---------- totals ---------- */}
          {lines.length > 0 && (
            <div
              style={{
                marginTop: "6px",
                padding: "10px 12px",
                background: "#111113",
                border: "1px solid #27272a",
                borderRadius: "8px",
                display: "grid",
                gap: "4px",
                fontSize: "13px",
                color: "#a1a1aa",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Gold + Silver</span>
                <b style={{ color: "#22c55e" }}>₹{money(additions)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Old metal + Discount</span>
                <b style={{ color: "#ef4444" }}>-₹{money(deductions)}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid #27272a",
                  paddingTop: "6px",
                  marginTop: "2px",
                  fontSize: "15px",
                }}
              >
                <span style={{ color: "#e4e4e7", fontWeight: "700" }}>Total Amount</span>
                <b style={{ color: "#22c55e" }}>₹{money(Math.max(total, 0))}</b>
              </div>
              {total < 0 && (
                <div style={{ color: "#f59e0b", fontSize: "12px" }}>
                  ⚠ Old metal + discount is higher than gold + silver by ₹
                  {money(Math.abs(total))}.
                </div>
              )}
            </div>
          )}

          {/* ---------- preview ---------- */}
          {text && (
            <pre
              style={{
                margin: "10px 0 0",
                padding: "10px 12px",
                background: "#111113",
                border: "1px dashed #3f3f46",
                borderRadius: "8px",
                color: "#a1a1aa",
                fontSize: "12px",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "inherit",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {text}
            </pre>
          )}

          {/* ---------- actions ---------- */}
          <div className="helper-actions">
            <button
              type="button"
              disabled={!text}
              onClick={() => onApply({ text, total })}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: "8px",
                border: "none",
                background: text ? "#f97316" : "#27272a",
                color: "#fff",
                fontWeight: "600",
                fontSize: "13.5px",
                cursor: text ? "pointer" : "not-allowed",
              }}
            >
              Apply to Description & Amount
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ConfirmPublishModal = ({
  customerName,
  mobileNo,
  billDate,
  grandTotal,
  amountPaid,
  balanceDue,
  loading,
  onCancel,
  onConfirm,
}) => (
  <div
    role="dialog"
    aria-modal="true"
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "16px",
    }}
    onClick={onCancel}
  >
    <div
      className="modal-card"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: "440px",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "26px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ color: "#f97316", fontSize: "17px", fontWeight: "700", marginBottom: "4px" }}>
        Confirm Bill Details
      </div>

      <div style={{ color: "#71717a", fontSize: "12.5px", marginBottom: "18px" }}>
        Please review before publishing this bill.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
        <ConfirmRow label="Customer" value={customerName || "-"} />
        <ConfirmRow label="Mobile" value={mobileNo || "-"} />
        <ConfirmRow label="Bill Date" value={formatDisplayDate(billDate)} />
        <ConfirmRow label="Grand Total" value={`₹${grandTotal.toFixed(2)}`} />
        <ConfirmRow label="Amount Paid" value={`₹${amountPaid.toFixed(2)}`} />
        <ConfirmRow label="Balance Due" value={`₹${balanceDue.toFixed(2)}`} />
      </div>

      <div className="modal-actions" style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: "#e4e4e7",
            fontWeight: "600",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#52525b" : "#f97316",
            color: "#fff",
            fontWeight: "600",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Publishing..." : "Confirm & Publish"}
        </button>
      </div>
    </div>
  </div>
);

const ConfirmRow = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      padding: "10px 12px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "7px",
    }}
  >
    <span style={{ color: "#a1a1aa", fontSize: "13px" }}>{label}</span>
    <span style={{ color: "#fff", fontSize: "14px", fontWeight: "600", textAlign: "right" }}>
      {value}
    </span>
  </div>
);

// Header row for each collapsible item / exchange / payment card.
// Tap the title area to fold or unfold; the bin button removes the row.
const CardHeader = ({ title, summary, isCollapsed, onToggle, onDelete, deleteTitle }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "8px",
      marginBottom: isCollapsed ? "0" : "10px",
    }}
  >
    <button
      type="button"
      className="card-toggle"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "0",
        border: "none",
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: "#f97316",
          fontSize: "12px",
          display: "inline-block",
          transition: "transform 0.15s ease",
          transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
        }}
      >
        ▶
      </span>

      <span style={{ color: "#a1a1aa", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap" }}>
        {title}
      </span>

      {isCollapsed && summary && (
        <span
          style={{
            color: "#71717a",
            fontSize: "12.5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {summary}
        </span>
      )}
    </button>

    <button
      type="button"
      onClick={onDelete}
      title={deleteTitle}
      aria-label={deleteTitle}
      style={{ ...deleteButtonStyle, minWidth: "44px" }}
    >
      🗑
    </button>
  </div>
);

const SectionCard = ({ children }) => (
  <div
    className="section-card"
    style={{
      padding: "20px",
      border: "1px solid #27272a",
      borderRadius: "10px",
      background: "#111113",
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ title, marginBottom = "12px" }) => (
  <div style={{ color: "#f97316", fontSize: "15px", fontWeight: "600", marginBottom }}>
    {title}
  </div>
);

const MoneyInput = ({ placeholder, value, onChange, compact = false, inputRef }) => (
  <div style={{ position: "relative" }}>
    <span
      style={{
        position: "absolute",
        left: compact ? "9px" : "12px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#a1a1aa",
        fontSize: compact ? "12px" : "14px",
        pointerEvents: "none",
      }}
    >
      ₹
    </span>

    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={value}
      ref={inputRef}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.]/g, "");
        onChange({ target: { value: cleaned } });
      }}
      style={{
        ...inputStyle,
        padding: compact ? "10px 8px 10px 25px" : "13px 12px 13px 30px",
        fontSize: compact ? "13px" : "15px",
        minWidth: 0,
      }}
    />
  </div>
);

const AddButton = ({ onClick, disabled = false, text }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      border: "none",
      background: disabled ? "#27272a" : "#f97316",
      color: "#fff",
      borderRadius: "7px",
      padding: "9px 14px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "13px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </button>
);

const SummaryBox = ({ label, value, color = "#fff", large = false, className = "" }) => (
  <div
    className={className}
    style={{
      padding: "14px 12px",
      background: "#09090b",
      borderRadius: "8px",
      border: "1px solid #27272a",
      minWidth: 0,
    }}
  >
    <div
      style={{
        color: "#a1a1aa",
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "0.03em",
        marginBottom: "6px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={label}
    >
      {label}
    </div>

    <div
      style={{
        color,
        fontSize: large ? "19px" : "15px",
        fontWeight: "700",
        wordBreak: "break-word",
      }}
    >
      ₹{Number(value || 0).toFixed(2)}
    </div>
  </div>
);

const FieldError = ({ msg }) =>
  msg ? (
    <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "5px 0 0" }}>{msg}</p>
  ) : null;

const SmallError = ({ msg }) =>
  msg ? (
    <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px" }}>{msg}</div>
  ) : null;

// =========================================================
// STYLES
// =========================================================

const inputStyle = {
  width: "100%",
  padding: "13px",
  background: "#09090b",
  border: "1px solid #3f3f46",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#a1a1aa",
  fontSize: "13px",
  fontWeight: "500",
};

const smallLabelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#a1a1aa",
  fontSize: "12.5px",
  fontWeight: "500",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const amountWordsStyle = {
  color: "#a1a1aa",
  fontSize: "12px",
  marginTop: "5px",
  lineHeight: "1.4",
  fontStyle: "italic",
};

const twoColGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const threeColGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1.3fr 1fr",
  gap: "28px",
};

const itemGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
};

const exchangeGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
};

const paymentGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "12px",
  alignItems: "start",
};

const rowCardStyle = {
  marginBottom: "14px",
  paddingBottom: "14px",
  borderBottom: "1px solid #1f1f23",
};

const sectionTopRowStyle = (marginBottom) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: `${marginBottom}px`,
});

const emptyStyle = {
  color: "#52525b",
  fontSize: "13px",
  textAlign: "center",
  padding: "14px",
};

const subTotalStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "24px",
  flexWrap: "wrap",
  color: "#a1a1aa",
  fontSize: "13px",
  marginTop: "8px",
};

const deleteButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#ef4444",
  cursor: "pointer",
  fontSize: "18px",
  padding: "0",
  lineHeight: 1,
};

const searchIconButtonStyle = {
  position: "absolute",
  right: "6px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "36px",
  height: "36px",
  border: "none",
  borderRadius: "6px",
  background: "transparent",
  color: "#a1a1aa",
  fontSize: "16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default AddBillProduct;