import React, { useState, useContext, useRef, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

const AddLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // =========================================================
  // PERSON PREFILL
  // =========================================================

  const selectedPersonFromState = location.state?.person || null;
  const personIdFromQuery = new URLSearchParams(location.search).get("personId");
  const [selectedPerson, setSelectedPerson] = useState(selectedPersonFromState);
  const [personLoading, setPersonLoading] = useState(false);

  // =========================================================
  // REFS (for scroll-to-error on invalid submit)
  // =========================================================

  const fieldRefs = useRef({});

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const getToday = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getDueDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 3);
    return date.toISOString().split("T")[0];
  };
  const getReturnDate = () => {
    return;
  };
  const getDissolveDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5);
    return date.toISOString().split("T")[0];
  };

  const numberToWords = (num) => {
    num = Number(num);

    if (!Number.isFinite(num) || num === 0) {
      return "";
    }

    const ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const convertTwoDigits = (n) => {
      if (n < 20) return ones[n];

      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    };

    const convertThreeDigits = (n) => {
      if (n < 100) {
        return convertTwoDigits(n);
      }

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

    if (crore) {
      result += convertThreeDigits(crore) + " Crore ";
    }

    if (lakh) {
      result += convertTwoDigits(lakh) + " Lakh ";
    }

    if (thousand) {
      result += convertTwoDigits(thousand) + " Thousand ";
    }

    if (remainder) {
      result += convertThreeDigits(remainder);
    }

    return result.trim() + " Rupees Only";
  };

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    loanType:  "simple",
    name: "",
    address: "",
    customerId: "",
    loanId: "",
    mobileNo: "",
    description: "",
    goldWeight: "",
    silverWeight: "",

    // Original loan issue date
    date: getToday(),

    dueDate: getDueDate(),

    available: "yes",

    roi: 5,
    returnDate: "", // getReturnDate(),
    dissolveDate: getDissolveDate(),

    // Original loan
    loanAmount: "",
    interest: "",
    totalAmount: "",

    signed: "no",

    finalSettlement: "",

    // Maximum 20 re-loans
    reloans: [],

    // Separate payment section
    payments: [],
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
    // =========================================================
  // CUSTOMER ID SEARCH
  // =========================================================

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState({ type: "", text: "" });

  const handleCustomerSearch = async () => {
    const id = formData.customerId.trim().toUpperCase();

    if (!id) {
      setErrors((prev) => ({
        ...prev,
        customerId: "Enter a Customer ID to search.",
      }));
      fieldRefs.current.customerId?.focus();
      return;
    }

    setSearchLoading(true);
    setSearchMessage({ type: "", text: "" });

    try {
      const res = await fetch(
        `/api/people?customerId=${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check the API server is running.`,
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to search customer.");
      }

      // Support different response shapes: [..] or { people: [..] } etc.
      const list = Array.isArray(data)
        ? data
        : data.people || data.data || data.results || [];

      // Exact match on customer ID (case-insensitive)
      const person = list.find(
        (p) => String(p.customerId || "").toUpperCase() === id,
      );

      if (!person) {
        setSearchMessage({
          type: "error",
          text: `No customer found with ID "${id}".`,
        });
        return;
      }

      setSelectedPerson(person);

      setFormData((prev) => ({
        ...prev,
        name: person.name || "",
        address: person.address || "",
        customerId: person.customerId || id,
        mobileNo: person.phone || "",
      }));

      setErrors((prev) => ({
        ...prev,
        name: "",
        address: "",
        customerId: "",
        mobileNo: "",
      }));

      setSearchMessage({
        type: "success",
        text: `Customer details loaded for ${person.name || id}.`,
      });
    } catch (err) {
      console.error("Customer search failed:", err);
      setSearchMessage({
        type: "error",
        text: err.message || "Something went wrong while searching.",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearCustomer = () => {
    setSelectedPerson(null);
    setSearchMessage({ type: "", text: "" });

    setFormData((prev) => ({
      ...prev,
      name: "",
      address: "",
      customerId: "",
      mobileNo: "",
    }));
  };

  // =========================================================
  // LOAD PERSON DETAILS WHEN OPENED FROM PEOPLE DIRECTORY
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    const applyPerson = (person) => {
      if (!person || cancelled) return;

      setSelectedPerson(person);

      setFormData((prev) => ({
        ...prev,
        name: person.name || "",
        address: person.address || "",
        customerId: person.customerId || "",
        mobileNo: person.phone || "",
      }));
    };

    if (selectedPersonFromState) {
      applyPerson(selectedPersonFromState);
    }

    if (!personIdFromQuery || !user?.token) {
      return () => {
        cancelled = true;
      };
    }

    const loadPerson = async () => {
      try {
        setPersonLoading(true);

        const response = await fetch(`/api/people/${personIdFromQuery}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load person details");
        }

        applyPerson(data);
      } catch (error) {
        console.error("Failed to load person:", error);
      } finally {
        if (!cancelled) {
          setPersonLoading(false);
        }
      }
    };

    loadPerson();

    return () => {
      cancelled = true;
    };
  }, [personIdFromQuery, user?.token, selectedPersonFromState]);

  // =========================================================
  // CALCULATE INTEREST
  // =========================================================

  const calculateLoan = (amount, issueDate) => {
      if (formData.loanType === "simple") {
    const loanAmount = Number(amount || 0);

    return {
      days: 0,
      interest: 0,
      total: Number.isFinite(loanAmount) ? loanAmount : 0,
    };
  }
    if (
      amount === "" ||
      amount === null ||
      amount === undefined ||
      !issueDate ||
      formData.roi === "" ||
      formData.roi === null ||
      formData.roi === undefined
    ) {
      return {
        days: 0,
        interest: 0,
        total: 0,
      };
    }

    const loanAmount = Number(amount);
    const roi = Number(formData.roi);

    if (
      !Number.isFinite(loanAmount) ||
      !Number.isFinite(roi) ||
      loanAmount < 0
    ) {
      return {
        days: 0,
        interest: 0,
        total: 0,
      };
    }

    const loanDate = new Date(issueDate);
    const today = new Date();

    loanDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const differenceInTime = today.getTime() - loanDate.getTime();

    const differenceInDays = Math.max(
      30,
      Math.floor(differenceInTime / (1000 * 60 * 60 * 24)),
    );

    // Your existing formula
    const interest = (loanAmount * roi * differenceInDays) / 3000;

    const total = loanAmount + interest;

    return {
      days: differenceInDays,
      interest,
      total,
    };
  };

  // =========================================================
  // ORIGINAL LOAN CALCULATION
  // =========================================================

  const originalLoan = calculateLoan(formData.loanAmount, formData.date);

  // =========================================================
  // RELOAN CALCULATIONS
  // =========================================================

  const reloanCalculations = formData.reloans.map((reloan) =>
    calculateLoan(reloan.amount, reloan.issueDate),
  );

  const reloanAmount = formData.reloans.reduce(
    (sum, reloan) => sum + Number(reloan.amount || 0),
    0,
  );

  const reloanInterest = reloanCalculations.reduce(
    (sum, calculation) => sum + calculation.interest,
    0,
  );

  const reloanTotal = reloanCalculations.reduce(
    (sum, calculation) => sum + calculation.total,
    0,
  );

  // =========================================================
  // TOTAL LOAN / INTEREST / AMOUNT
  // =========================================================

  const grandLoanAmount = Number(formData.loanAmount || 0) + reloanAmount;

  const grandInterest = originalLoan.interest + reloanInterest;

  const grandTotal = originalLoan.total + reloanTotal;

  // =========================================================
  // PAYMENTS
  // =========================================================

  const totalPaid = formData.payments.reduce(
    (sum, payment) => sum + Number(payment.paidAmount || 0),
    0,
  );

  // FINAL AMOUNT
  // Paid date has NO effect on this calculation.
  const finalAmount = grandTotal - totalPaid;

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
  // ADD RELOAN
  // =========================================================

  const addReloan = () => {
    if (formData.reloans.length >= 20) {
      alert("Maximum 20 re-loans are allowed.");
      return;
    }

    setFormData((prev) => ({
      ...prev,

      reloans: [
        ...prev.reloans,

        {
          id: Date.now(),
          issueDate: getToday(),
          amount: "",
        },
      ],
    }));
  };

  // =========================================================
  // REMOVE RELOAN
  // =========================================================

  const removeReloan = (id) => {
    setFormData((prev) => ({
      ...prev,

      reloans: prev.reloans.filter((reloan) => reloan.id !== id),
    }));
  };

  // =========================================================
  // UPDATE RELOAN
  // =========================================================

  const updateReloan = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,

      reloans: prev.reloans.map((reloan) =>
        reloan.id === id
          ? {
              ...reloan,
              [field]: value,
            }
          : reloan,
      ),
    }));
  };

  // =========================================================
  // ADD PAYMENT
  // =========================================================

  const addPayment = () => {
    setFormData((prev) => ({
      ...prev,

      payments: [
        ...prev.payments,

        {
          id: Date.now(),
          paidAmount: "",
          paidDate: getToday(),
        },
      ],
    }));
  };

  // =========================================================
  // REMOVE PAYMENT
  // =========================================================

  const removePayment = (id) => {
    setFormData((prev) => ({
      ...prev,

      payments: prev.payments.filter((payment) => payment.id !== id),
    }));
  };

  // =========================================================
  // UPDATE PAYMENT
  // =========================================================

  const updatePayment = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,

      payments: prev.payments.map((payment) =>
        payment.id === id
          ? {
              ...payment,
              [field]: value,
            }
          : payment,
      ),
    }));
  };

  // =========================================================
  // SCROLL / FOCUS TO FIRST INVALID FIELD
  // =========================================================

  const scrollToFirstError = (errs) => {
    const errorKeys = Object.keys(errs).filter((k) => errs[k]);

    if (errorKeys.length === 0) return;

    // Object key order matches the order fields were validated in,
    // which mirrors the top-to-bottom order of the form.
    const firstErrorKey = errorKeys[0];
    const node = fieldRefs.current[firstErrorKey];

    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });

    // Give the smooth scroll a moment to settle before focusing,
    // so the browser doesn't yank the viewport back to the input.
    window.setTimeout(() => {
      if (typeof node.focus === "function") {
        node.focus({ preventScroll: true });
      }
    }, 350);
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    const errs = {};

    // Name
    if (!formData.name.trim()) {
      errs.name = "Name is required.";
    }

    if (wordCount(formData.name) > 60) {
      errs.name = "Name must be 60 words or fewer.";
    }

    // Address
    if (!formData.address.trim()) {
      errs.address = "Address is required.";
    }

    if (wordCount(formData.address) > 100) {
      errs.address = "Address must be 100 words or fewer.";
    }

    // Customer ID
    if (!/^[A-Z0-9]{1,8}$/.test(formData.customerId)) {
      errs.customerId =
        "Customer ID must contain letters and numbers only, max 8 characters.";
    }
    // Loan ID
    if (!/^[A-Z0-9]{1,8}$/.test(formData.loanId)) {
      errs.loanId =
        "Loan ID must contain letters and numbers only, max 8 characters.";
    }
    // Mobile
    if (formData.mobileNo && !/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = "Mobile No. must be exactly 10 digits.";
    }

    // Description
    if (!formData.description.trim()) {
      errs.description = "Description is required.";
    }

    if (wordCount(formData.description) > 300) {
      errs.description = "Description must be 300 words or fewer.";
    }
// Dates
if (!formData.date) {
  errs.date = "Issue date is required.";
}

if (formData.loanType === "jewellery") {
  if (!formData.dueDate) {
    errs.dueDate = "Due Date is required.";
  }

  if (formData.roi === "" || Number(formData.roi) < 0) {
    errs.roi = "Enter a valid ROI.";
  }
}
    // Original loan
const amount = Number(formData.loanAmount);

if (
  formData.loanAmount === "" ||
  !Number.isFinite(amount) ||
  amount <= 0
) {
  errs.loanAmount = "Enter a loan amount greater than zero.";
}
    // Reloans
  
    formData.reloans.forEach((reloan, index) => {
      if (!reloan.issueDate) {
        errs[`reloanDate_${index}`] = `Issue date is required for Reloan ${
          index + 1
        }.`;
      }

      if (reloan.amount === "" || Number(reloan.amount) < 0) {
        errs[`reloanAmount_${index}`] = `Enter a valid amount for Reloan ${
          index + 1
        }.`;
      }
    });
  
    // =========================================================
    // PAYMENTS
    // =========================================================

    let paidBeforeCurrent = 0;

    formData.payments.forEach((payment, index) => {
      const paidAmount = Number(payment.paidAmount || 0);

      // Amount remaining before this payment
      const remainingBeforePayment = grandTotal - paidBeforeCurrent;

      // Payment amount validation
      if (payment.paidAmount === "" || paidAmount <= 0) {
        errs[`paymentAmount_${index}`] =
          `Enter a valid payment amount for Payment ${index + 1}.`;
      } else if (paidAmount > remainingBeforePayment) {
        errs[`paymentAmount_${index}`] =
          `Payment cannot exceed the remaining amount of ₹${remainingBeforePayment.toFixed(
            2,
          )}.`;
      }

      // Payment date validation
      if (!payment.paidDate) {
        errs[`paymentDate_${index}`] = `Payment date is required for Payment ${
          index + 1
        }.`;
      }

      // Add current payment before checking
      // the next payment
      paidBeforeCurrent += paidAmount;
    });

    // =========================================================
    // TOTAL PAYMENTS VALIDATION
    // =========================================================

    const enteredPaidAmount = formData.payments.reduce(
      (sum, payment) => sum + Number(payment.paidAmount || 0),
      0,
    );

    if (enteredPaidAmount > grandTotal) {
      errs.payments = "Total paid amount cannot exceed the total loan amount.";
    }
    // Final settlement
    if (formData.finalSettlement && wordCount(formData.finalSettlement) > 100) {
      errs.finalSettlement = "Final Settlement must be 100 words or fewer.";
    }

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
    }

    return Object.keys(errs).length === 0;
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  // Validates the form and, if valid, opens the confirmation popup
  // instead of submitting straight away.
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setShowConfirm(true);
  };

  // Runs only after the user confirms in the popup.
  const confirmSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      // Remove frontend-only IDs
      const cleanedReloans = formData.reloans.map((reloan) => {
        const calculation = calculateLoan(reloan.amount, reloan.issueDate);

        return {
          issueDate: reloan.issueDate,

          amount: Number(reloan.amount),

          interest: Number(calculation.interest.toFixed(2)),

          totalAmount: Number(calculation.total.toFixed(2)),
        };
      });

      const cleanedPayments = formData.payments.map((payment) => ({
        paidAmount: Number(payment.paidAmount),

        paidDate: payment.paidDate,
      }));

      const isSimple = formData.loanType === "simple";

const submitData = {
  ...formData,

  ...(selectedPerson?._id ? { personId: selectedPerson._id } : {}),

  goldWeight: isSimple ? 0 : Number(formData.goldWeight || 0),
  silverWeight: isSimple ? 0 : Number(formData.silverWeight || 0),

  mobileNo: formData.mobileNo.trim(),
  loanAmount: Number(formData.loanAmount),

  roi: isSimple ? 0 : Number(formData.roi),

  dueDate: isSimple ? undefined : formData.dueDate,
  available: isSimple ? undefined : formData.available,
  signed: isSimple ? undefined : formData.signed,
  dissolveDate: isSimple ? undefined : formData.dissolveDate,

  interest: Number(originalLoan.interest.toFixed(2)),
  totalAmount: Number(originalLoan.total.toFixed(2)),

  reloans: cleanedReloans,
  payments: cleanedPayments,
};
      const res = await fetch("/api/loans", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${user.token}`,
        },

        body: JSON.stringify(submitData),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        // The server didn't return JSON at all — usually means the
        // request never reached the backend (wrong URL, proxy not
        // configured, or backend not running) and hit something
        // returning an HTML page instead.
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check that the API server is running and the request URL/proxy is correct.`,
        );
      }

      const responseData = await res.json();

      if (res.ok) {
        // Keep the People Directory linked to this new loan.
        if (selectedPerson?._id && formData.loanId) {
          try {
            const existingLoanIds = Array.isArray(selectedPerson.loanIds)
              ? selectedPerson.loanIds
              : [];

            const nextLoanIds = Array.from(
              new Set([
                ...existingLoanIds,
                formData.loanId.trim().toUpperCase(),
              ])
            );

            await fetch(`/api/people/${selectedPerson._id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user.token}`,
              },
              body: JSON.stringify({
                loanIds: nextLoanIds,
                hasLoan: true,
              }),
            });
          } catch (linkError) {
            console.error("Loan created, but person link failed:", linkError);
          }
        }

        alert("Loan created successfully!");

        navigate("/admin/loan/products");
      } else {
        alert(responseData.message || "Error creating loan");
      }
    } catch (error) {
      console.error("Error creating loan:", error);

      alert(error.message || "Something went wrong while creating the loan.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // ADMIN CHECK
  // =========================================================

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        maxWidth: "1360px",
        margin: "30px auto",
        background: "#18181b",
        padding: "36px 40px",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.05)",
        boxSizing: "border-box",
      }}
    >
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
  LOAN
</h1>

<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "26px",
  }}
></div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "26px",
        }}
      >
        <h2
          style={{
            color: "#f97316",
            margin: 0,
            fontSize: "22px",
          }}
        >
          Add New Loan
        </h2>

        <button
          type="button"
          onClick={() => navigate("/admin/loan/products")}
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
          📄 Manage Loans
        </button>
      </div>

      {selectedPerson && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(59,130,246,0.25)",
            background: "rgba(59,130,246,0.08)",
            color: "#93c5fd",
            fontSize: "13px",
          }}
        >
          {personLoading
            ? "Loading person details..."
            : `Loan is being added for ${selectedPerson.name || "this person"}. Personal details are copied from the People Directory.`}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
      <div>
  <label style={labelStyle}>Loan Type</label>

  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
    {[
      { value: "simple", label: "Simple Loan" },
      { value: "jewellery", label: "Jewellery Loan" },
    ].map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => {
          setFormData((prev) => ({
            ...prev,
            loanType: option.value,
            ...(option.value === "simple"
              ? {
                  goldWeight: "",
                  silverWeight: "",
                  dueDate: "",
                  available: "yes",
                  roi: 0,
                  dissolveDate: "",
                  signed: "no",
               //   reloans: [],
                }
              : {
                  dueDate: getDueDate(),
                  roi: 5,
                  dissolveDate: getDissolveDate(),
                }),
          }));

          setErrors({});
        }}
        style={{
          padding: "12px 22px",
          borderRadius: "8px",
          border:
            formData.loanType === option.value
              ? "1px solid #f97316"
              : "1px solid #3f3f46",
          background:
            formData.loanType === option.value
              ? "rgba(249,115,22,0.12)"
              : "#09090b",
          color:
            formData.loanType === option.value ? "#f97316" : "#a1a1aa",
          fontWeight: "600",
          cursor: "pointer",
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>
        {/* =====================================================
            NAME
        ====================================================== */}
        <div>
          <label style={labelStyle}>Name</label>

          <input
            type="text"
            placeholder="Full name"
            required
            readOnly={Boolean(selectedPerson && formData.mobileNo)}
            value={formData.name}
            onChange={(e) => {
              const value = e.target.value
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());

              handleChange("name", value);
            }}
            ref={(el) => (fieldRefs.current.name = el)}
            style={inputStyle}
          />

          <FieldError msg={errors.name} />
        </div>
        {/* =====================================================
            ADDRESS
        ====================================================== */}
        <div>
          <label style={labelStyle}>Address</label>

          <textarea
            placeholder="Address"
            required
            rows="2"
            readOnly={Boolean(selectedPerson)}
            value={formData.address}
            onChange={(e) => {
                const value = e.target.value
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
                handleChange("address", value)}}
            ref={(el) => (fieldRefs.current.address = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.address} />
        </div>
        {/* =====================================================
            CUSTOMER ID + MOBILE
        ====================================================== */}
        <div className="three-col" style={threeColGridStyle}>
           <div>
            <label style={labelStyle}>Customer ID (max 8 characters)</label>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Customer ID"
                required
                maxLength={8}
                readOnly={Boolean(selectedPerson)}
                value={formData.customerId}
                onChange={(e) => {
                  const value = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8);

                  handleChange("customerId", value);
                  if (searchMessage.text) {
                    setSearchMessage({ type: "", text: "" });
                  }
                }}
                onKeyDown={(e) => {
                  // Enter = search, not form submit
                  if (e.key === "Enter" && !selectedPerson) {
                    e.preventDefault();
                    handleCustomerSearch();
                  }
                }}
                ref={(el) => (fieldRefs.current.customerId = el)}
                style={{ ...inputStyle, paddingRight: "48px" }}
              />

              {selectedPerson ? (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  title="Clear customer and search again"
                  style={searchIconButtonStyle}
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCustomerSearch}
                  disabled={searchLoading}
                  title="Search customer by ID"
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

            <FieldError msg={errors.customerId} />
          </div>

          <div>
            <label style={labelStyle}>Mobile No.</label>

           <input
  type="text"
  placeholder="10-digit mobile number"
  maxLength={10}
  readOnly={Boolean(selectedPerson && selectedPerson.phone)}
  value={formData.mobileNo}
  onChange={(e) =>
    handleChange(
      "mobileNo",
      e.target.value.replace(/[^0-9]/g, "")
    )
  }
  ref={(el) => (fieldRefs.current.mobileNo = el)}
  style={inputStyle}
/>

            <FieldError msg={errors.mobileNo} />
          </div>

          <div>
            <label style={labelStyle}>loan ID (max 8 characters)</label>

            <input
              type="text"
              placeholder="loan ID"
              required
              maxLength={8}
              value={formData.loanId}
              onChange={(e) => {
                const value = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 8);

                handleChange("loanId", value);
              }}
              ref={(el) => (fieldRefs.current.loanId = el)}
              style={inputStyle}
            />

            <FieldError msg={errors.loanId} />
          </div>
        </div>
        {/* =====================================================
            GOLD / SILVER WEIGHT
        ====================================================== */}
        {formData.loanType === "jewellery" && (
  <>
        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Gold Weight (g)</label>

            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="0.001"
              placeholder="Gold weight in grams"
              value={formData.goldWeight}
              onChange={(e) => handleChange("goldWeight", e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Silver Weight (g)</label>

            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="0.001"
              placeholder="Silver weight in grams"
              value={formData.silverWeight}
              onChange={(e) => handleChange("silverWeight", e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
          </>
)}
        {/* =====================================================
            DESCRIPTION
        ====================================================== */}
        <div>
          <label style={labelStyle}>Description</label>

          <textarea
           placeholder={
  formData.loanType === "simple"
    ? "Loan purpose or description"
    : "Description of the pledged item(s)"
}
            required
            rows="4"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            ref={(el) => (fieldRefs.current.description = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.description} />
        </div>
        {/* =====================================================
            ISSUE DATE + DUE DATE
        ====================================================== */}
       {/* =====================================================
    ISSUE DATE + DUE DATE
====================================================== */}
<div
  className="two-col"
  style={{
    ...twoColGridStyle,
    gridTemplateColumns:
      formData.loanType === "jewellery" ? "repeat(2, 1fr)" : "1fr",
  }}
>
  <div>
    <label style={labelStyle}>Issue Date</label>

    <input
      type="date"
      required
      value={formData.date}
      onChange={(e) => handleChange("date", e.target.value)}
      ref={(el) => (fieldRefs.current.date = el)}
      style={{ ...inputStyle, cursor: "pointer" }}
    />
    <FieldError msg={errors.date} />
  </div>

  {formData.loanType === "jewellery" && (
    <div>
      <label style={labelStyle}>Due Date</label>

      <input
        type="date"
        required
        value={formData.dueDate}
        onChange={(e) => handleChange("dueDate", e.target.value)}
        ref={(el) => (fieldRefs.current.dueDate = el)}
        style={{ ...inputStyle, cursor: "pointer" }}
      />
      <FieldError msg={errors.dueDate} />
    </div>
  )}
</div>
        {/* =====================================================
            AVAILABLE + ROI
        ====================================================== */}
        {formData.loanType === "jewellery" && (
  <div className="two-col" style={twoColGridStyle}>
    <div>
      <label style={labelStyle}>Available</label>

      <select
        value={formData.available}
        onChange={(e) => handleChange("available", e.target.value)}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>

    <div>
      <label style={labelStyle}>ROI (%)</label>

      <input
        type="text"
        inputMode="numeric"
        min="0"
        step="0.01"
        value={formData.roi}
        onChange={(e) => handleChange("roi", e.target.value)}
        ref={(el) => (fieldRefs.current.roi = el)}
        style={inputStyle}
      />

      <FieldError msg={errors.roi} />
    </div>
  </div>
)}

        {/*    ===================================================
          Return Date
        ================================================ */}
       <div
  className="two-col"
  style={{
    ...twoColGridStyle,
    gridTemplateColumns:
      formData.loanType === "jewellery" ? "repeat(2, 1fr)" : "1fr",
  }}
>
  {/* Return Date - Both loan types */}
  <div>
    <label style={labelStyle}>Return Date</label>

    <input
      type="date"
      value={formData.returnDate}
      onChange={(e) => handleChange("returnDate", e.target.value)}
      style={{
        ...inputStyle,
        cursor: "pointer",
        maxWidth: "320px",
      }}
    />
  </div>

  {/* Dissolve Date - Jewellery Loan only */}
  {formData.loanType === "jewellery" && (
    <div>
      <label style={labelStyle}>Dissolve Date</label>

      <input
        type="date"
        value={formData.dissolveDate}
        onChange={(e) => handleChange("dissolveDate", e.target.value)}
        style={{
          ...inputStyle,
          cursor: "pointer",
          maxWidth: "320px",
        }}
      />
    </div>
  )}
</div>
        {/* =====================================================
            ORIGINAL LOAN
        ====================================================== */}
        <SectionCard>
          <SectionHeader title="Original Loan" />

          <div
            className="original-loan-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr 1fr",
              gap: "16px",
            }}
          >
            {/* Loan Amount */}
            <div ref={(el) => (fieldRefs.current.loanAmount = el)}>
              <label style={smallLabelStyle}>Loan Amount</label>

              <MoneyInput
                placeholder="Loan Amount"
                value={formData.loanAmount}
                onChange={(e) => handleChange("loanAmount", e.target.value)}
              />

              {formData.loanAmount && (
                <div style={amountWordsStyle}>
                  {numberToWords(formData.loanAmount)}
                </div>
              )}
            </div>

            {/* Interest */}
            <div>
              <label style={smallLabelStyle}>Interest</label>

              <ReadOnlyMoneyInput
                placeholder="Interest"
                value={
                  formData.loanAmount !== ""
                    ? originalLoan.interest.toFixed(2)
                    : ""
                }
              />
            </div>

            {/* Total */}
            <div>
              <label style={smallLabelStyle}>Total Amount</label>

              <ReadOnlyMoneyInput
                placeholder="Total Amount"
                value={
                  formData.loanAmount !== ""
                    ? originalLoan.total.toFixed(2)
                    : ""
                }
              />
            </div>
          </div>

          <FieldError msg={errors.loanAmount} />

          {formData.loanAmount !== "" && formData.loanType === "jewellery" && (
            <div
              style={{
                marginTop: "10px",
                color: "#71717a",
                fontSize: "12.5px",
              }}
            >
              Interest calculated for{" "}
              <b
                style={{
                  color: "#f59e0b",
                }}
              >
                {originalLoan.days}
              </b>{" "}
              days
            </div>
          )}
        </SectionCard>
        {/* Re-Loans and Payments are managed only from Edit Loan. */}
        {/* =====================================================
            FINAL SUMMARY
        ====================================================== */}
        <div
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
            {formData.loanType === "simple"
  ? "Simple Loan Summary"
  : "Jewellery Loan Summary"}
          </div>

          <div
            className="summary-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
            <SummaryBox label="Loan Amount" value={grandLoanAmount} />

            <SummaryBox
              label="Interest"
              value={grandInterest}
              color="#f59e0b"
            />

            <SummaryBox label="Total Amount" value={grandTotal} />

            <SummaryBox label="Total Paid" value={totalPaid} color="#ef4444" />

            <SummaryBox
              label="FINAL AMOUNT"
              value={finalAmount}
              color="#22c55e"
              large
            />
          </div>
        </div>
        {/* =====================================================
            SIGNED
        ====================================================== */}
       {formData.loanType === "jewellery" && ( 
        <div>
          <label style={labelStyle}>Signed</label>

          <select
            value={formData.signed}
            onChange={(e) => handleChange("signed", e.target.value)}
            style={{ ...inputStyle, cursor: "pointer", maxWidth: "320px" }}
          >
            <option value="no">No</option>

            <option value="yes">Yes</option>
          </select>
        </div>
        )}
        {/* =====================================================
            FINAL SETTLEMENT
        ====================================================== */}
        <div>
          <label style={labelStyle}>Final Settlement</label>

          <textarea
            placeholder="Final Settlement notes"
            rows="3"
            value={formData.finalSettlement}
            onChange={(e) => handleChange("finalSettlement", e.target.value)}
            ref={(el) => (fieldRefs.current.finalSettlement = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.finalSettlement} />
        </div>
        {/* =====================================================
            SUBMIT
        ====================================================== */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "8px",
            padding: "14px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#52525b" : "#f97316",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "15px",
          }}
        >
          {loading ? "Creating..." : "Publish Loan"}
        </button>
      </form>

      {/* =====================================================
          CONFIRM PUBLISH MODAL
      ====================================================== */}

      {showConfirm && (
        <ConfirmPublishModal
          name={formData.name}
          customerId={formData.customerId}
          loanAmount={Number(formData.loanAmount || 0)}
          reloanAmount={reloanAmount}
          paymentAmount={totalPaid}
          loanDate={formData.date}
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

        /* Laptop / tablet: keep reloan + payment rows on one line but
           give interest/total columns enough room so numbers don't clip */
        @media (max-width: 1100px) {
          .original-loan-grid {
            grid-template-columns: 1fr !important;
          }

          .summary-grid {
            grid-template-columns: repeat(3, minmax(120px, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .two-col {
            grid-template-columns: 1fr !important;
          }

.three-col {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr !important;
  gap: 10px;
}

          .reloan-row,
          .reloan-header {
            grid-template-columns: 26px 1.1fr 1fr 95px 105px 30px !important;
            gap: 6px !important;
          }
        }

        @media (max-width: 640px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(120px, 1fr)) !important;
          }

          .payment-row,
          .payment-header {
            grid-template-columns: 24px 1fr 1fr 28px !important;
            gap: 6px !important;
          }
        }

        @media (max-width: 560px) {
          .reloan-row,
          .reloan-header {
            grid-template-columns: 22px 1fr 1fr 78px 88px 26px !important;
            gap: 4px !important;
            font-size: 11px;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr !important;
          }
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
      `}</style>
    </div>
  );
};

// =========================================================
// COMPONENTS
// =========================================================

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

const ConfirmPublishModal = ({
  name,
  customerId,
  loanAmount,
  reloanAmount,
  paymentAmount,
  loanDate,
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
      <div
        style={{
          color: "#f97316",
          fontSize: "17px",
          fontWeight: "700",
          marginBottom: "4px",
        }}
      >
        Confirm Loan Details
      </div>

      <div
        style={{
          color: "#71717a",
          fontSize: "12.5px",
          marginBottom: "18px",
        }}
      >
        Please review before publishing this loan.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "22px",
        }}
      >
        <ConfirmRow label="Name" value={name || "-"} />
        <ConfirmRow label="CustomerId" value={customerId || "-"} />
        <ConfirmRow label="Date of Loan" value={formatDisplayDate(loanDate)} />
        <ConfirmRow label="Loan Amount" value={`₹${loanAmount.toFixed(2)}`} />
        <ConfirmRow
          label="Reloan Amount"
          value={`₹${reloanAmount.toFixed(2)}`}
        />
        <ConfirmRow
          label="Payment Amount"
          value={`₹${paymentAmount.toFixed(2)}`}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
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
      padding: "10px 12px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "7px",
    }}
  >
    <span
      style={{
        color: "#a1a1aa",
        fontSize: "13px",
      }}
    >
      {label}
    </span>

    <span
      style={{
        color: "#fff",
        fontSize: "14px",
        fontWeight: "600",
      }}
    >
      {value}
    </span>
  </div>
);

const SectionCard = ({ children }) => (
  <div
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

const amountWordsStyle = {
  color: "#a1a1aa",
  fontSize: "12px",
  marginTop: "5px",
  lineHeight: "1.4",
  fontStyle: "italic",
};

const SectionHeader = ({ title, marginBottom = "12px" }) => (
  <div
    style={{
      color: "#f97316",
      fontSize: "15px",
      fontWeight: "600",
      marginBottom,
    }}
  >
    {title}
  </div>
);

const MoneyInput = ({ placeholder, value, onChange, compact = false }) => (
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
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        // Only allow numbers
        const value = e.target.value.replace(/\D/g, "");

        onChange({
          target: {
            value,
          },
        });
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

const ReadOnlyMoneyInput = ({ placeholder, value }) => (
  <div style={{ position: "relative" }}>
    <span
      style={{
        position: "absolute",
        left: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#71717a",
        fontSize: "14px",
        pointerEvents: "none",
      }}
    >
      ₹
    </span>

    <input
      type="text"
      readOnly
      placeholder={placeholder}
      value={value}
      style={{
        ...inputStyle,
        paddingLeft: "30px",
        cursor: "not-allowed",
        opacity: 0.85,
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

const SummaryBox = ({ label, value, color = "#fff", large = false }) => (
  <div
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
    <p
      style={{
        color: "#ef4444",
        fontSize: "0.8rem",
        margin: "5px 0 0",
      }}
    >
      {msg}
    </p>
  ) : null;

const SmallError = ({ msg }) =>
  msg ? (
    <div
      style={{
        color: "#ef4444",
        fontSize: "11px",
        marginTop: "4px",
        marginLeft: "32px",
      }}
    >
      {msg}
    </div>
  ) : null;

// =========================================================
// STYLES
// =========================================================

const inputStyle = {
  width: "100%",
  padding: "13px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#a1a1aa",
  fontSize: "0.9rem",
  fontWeight: "500",
};

const smallLabelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#71717a",
  fontSize: "11.5px",
  fontWeight: "600",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
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

const reloanGridStyle = {
  display: "grid",
  gridTemplateColumns: "32px 1.1fr 1fr 120px 130px 32px",
  gap: "10px",
  alignItems: "center",
  fontSize: "11px",
  color: "#71717a",
  letterSpacing: "0.02em",
};

const paymentGridStyle = {
  display: "grid",
  gridTemplateColumns: "32px 1fr 1fr 32px",
  gap: "10px",
  alignItems: "center",
  fontSize: "11px",
  color: "#71717a",
  letterSpacing: "0.02em",
};

const subTotalStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "24px",
  flexWrap: "wrap",
  color: "#a1a1aa",
  fontSize: "13px",
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

export default AddLoanProduct;