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
    loanType: "simple",
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
    returnDate: "",
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
  // SCROLL / FOCUS TO FIRST INVALID FIELD
  // =========================================================

  const scrollToFirstError = (errs) => {
    const errorKeys = Object.keys(errs).filter((k) => errs[k]);

    if (errorKeys.length === 0) return;

    const firstErrorKey = errorKeys[0];
    const node = fieldRefs.current[firstErrorKey];

    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });

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

    if (formData.loanAmount === "" || !Number.isFinite(amount) || amount <= 0) {
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

    // Payments
    let paidBeforeCurrent = 0;

    formData.payments.forEach((payment, index) => {
      const paidAmount = Number(payment.paidAmount || 0);

      const remainingBeforePayment = grandTotal - paidBeforeCurrent;

      if (payment.paidAmount === "" || paidAmount <= 0) {
        errs[`paymentAmount_${index}`] =
          `Enter a valid payment amount for Payment ${index + 1}.`;
      } else if (paidAmount > remainingBeforePayment) {
        errs[`paymentAmount_${index}`] =
          `Payment cannot exceed the remaining amount of ₹${remainingBeforePayment.toFixed(
            2,
          )}.`;
      }

      if (!payment.paidDate) {
        errs[`paymentDate_${index}`] = `Payment date is required for Payment ${
          index + 1
        }.`;
      }

      paidBeforeCurrent += paidAmount;
    });

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

  // Validates the form and, if valid, opens the confirmation popup.
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
              ]),
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

  const isJewellery = formData.loanType === "jewellery";

  return (
    <div className="alp-wrap">
      <h1 className="alp-title">LOAN</h1>

      <div className="alp-head">
        <h2 className="alp-subtitle">Add New Loan</h2>

        <button
          type="button"
          className="alp-manage-btn"
          onClick={() => navigate("/admin/loan/products")}
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
            lineHeight: 1.5,
          }}
        >
          {personLoading
            ? "Loading person details..."
            : `Loan is being added for ${selectedPerson.name || "this person"}. Personal details are copied from the People Directory.`}
        </div>
      )}

      <form onSubmit={handleSubmit} className="alp-form">
        {/* =====================================================
            LOAN TYPE
        ====================================================== */}
        <div>
          <label style={labelStyle}>Loan Type</label>

          <div className="alp-type-row">
            {[
              { value: "simple", label: "Simple Loan" },
              { value: "jewellery", label: "Jewellery Loan" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className="alp-type-btn"
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
            autoComplete="off"
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
              handleChange("address", value);
            }}
            ref={(el) => (fieldRefs.current.address = el)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.address} />
        </div>

        {/* =====================================================
            CUSTOMER ID + MOBILE + LOAN ID
        ====================================================== */}
        <div className="alp-three">
          <div>
            <label style={labelStyle}>Customer ID (max 8 characters)</label>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Customer ID"
                required
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
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
                style={{ ...inputStyle, paddingRight: "52px" }}
              />

              {selectedPerson ? (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  title="Clear customer and search again"
                  aria-label="Clear customer"
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
                  aria-label="Search customer by ID"
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
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              maxLength={10}
              autoComplete="off"
              readOnly={Boolean(selectedPerson && selectedPerson.phone)}
              value={formData.mobileNo}
              onChange={(e) =>
                handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))
              }
              ref={(el) => (fieldRefs.current.mobileNo = el)}
              style={inputStyle}
            />

            <FieldError msg={errors.mobileNo} />
          </div>

          <div>
            <label style={labelStyle}>Loan ID (max 8 characters)</label>

            <input
              type="text"
              placeholder="Loan ID"
              required
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
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
        {isJewellery && (
          <div className="alp-two">
            <div>
              <label style={labelStyle}>Gold Weight (g)</label>

              <input
                type="text"
                inputMode="decimal"
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
                inputMode="decimal"
                placeholder="Silver weight in grams"
                value={formData.silverWeight}
                onChange={(e) => handleChange("silverWeight", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
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
        <div className={isJewellery ? "alp-two" : "alp-one"}>
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

          {isJewellery && (
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
        {isJewellery && (
          <div className="alp-two">
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
                inputMode="decimal"
                value={formData.roi}
                onChange={(e) =>
                  handleChange("roi", e.target.value.replace(/[^0-9.]/g, ""))
                }
                ref={(el) => (fieldRefs.current.roi = el)}
                style={inputStyle}
              />

              <FieldError msg={errors.roi} />
            </div>
          </div>
        )}

        {/* =====================================================
            RETURN DATE + DISSOLVE DATE
        ====================================================== */}
        <div className={isJewellery ? "alp-two" : "alp-one"}>
          <div>
            <label style={labelStyle}>Return Date</label>

            <input
              type="date"
              value={formData.returnDate}
              onChange={(e) => handleChange("returnDate", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
          </div>

          {isJewellery && (
            <div>
              <label style={labelStyle}>Dissolve Date</label>

              <input
                type="date"
                value={formData.dissolveDate}
                onChange={(e) => handleChange("dissolveDate", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
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
            className="alp-original"
            style={
              isJewellery ? undefined : { gridTemplateColumns: "minmax(0, 360px)" }
            }
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

            {/* Interest (jewellery only) */}
            {isJewellery && (
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
            )}

            {/* Total (jewellery only) */}
            {isJewellery && (
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
            )}
          </div>

          <FieldError msg={errors.loanAmount} />

          {formData.loanAmount !== "" && isJewellery && (
            <div
              style={{
                marginTop: "10px",
                color: "#71717a",
                fontSize: "12.5px",
              }}
            >
              Interest calculated for{" "}
              <b style={{ color: "#f59e0b" }}>{originalLoan.days}</b> days
            </div>
          )}
        </SectionCard>

        {/* Re-Loans and Payments are managed only from Edit Loan. */}

        {/* =====================================================
            FINAL SUMMARY
        ====================================================== */}
        <div className="alp-summary-card">
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

          <div className={isJewellery ? "alp-summary" : "alp-summary alp-summary-simple"}>
            <SummaryBox label="Loan Amount" value={grandLoanAmount} />

            {isJewellery && (
              <SummaryBox label="Interest" value={grandInterest} color="#f59e0b" />
            )}

            {isJewellery && <SummaryBox label="Total Amount" value={grandTotal} />}

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
        {isJewellery && (
          <div>
            <label style={labelStyle}>Signed</label>

            <select
              value={formData.signed}
              onChange={(e) => handleChange("signed", e.target.value)}
              className="alp-narrow"
              style={{ ...inputStyle, cursor: "pointer" }}
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
          className="alp-submit"
          style={{
            background: loading ? "#52525b" : "#f97316",
            cursor: loading ? "not-allowed" : "pointer",
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

      <style>{responsiveCss}</style>
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
    className="alp-overlay"
    onClick={onCancel}
  >
    <div className="alp-modal" onClick={(e) => e.stopPropagation()}>
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

      <div className="alp-modal-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1,
            padding: "13px",
            minHeight: "46px",
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
            padding: "13px",
            minHeight: "46px",
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
    <span
      style={{
        color: "#a1a1aa",
        fontSize: "13px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>

    <span
      style={{
        color: "#fff",
        fontSize: "14px",
        fontWeight: "600",
        textAlign: "right",
        wordBreak: "break-word",
        minWidth: 0,
      }}
    >
      {value}
    </span>
  </div>
);

const SectionCard = ({ children }) => (
  <div className="alp-card">{children}</div>
);

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
        const cleaned = e.target.value.replace(/\D/g, "");

        onChange({
          target: {
            value: cleaned,
          },
        });
      }}
      style={{
        ...inputStyle,
        padding: compact ? "10px 8px 10px 25px" : "13px 12px 13px 30px",
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

// =========================================================
// STYLES
// =========================================================

const amountWordsStyle = {
  color: "#a1a1aa",
  fontSize: "12px",
  marginTop: "5px",
  lineHeight: "1.4",
  fontStyle: "italic",
};

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
  minWidth: 0,
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

const searchIconButtonStyle = {
  position: "absolute",
  right: "4px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "42px",
  height: "42px",
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

// =========================================================
// RESPONSIVE CSS (desktop defaults + tablet + mobile)
// =========================================================

const responsiveCss = `
  .alp-wrap {
    max-width: 1360px;
    margin: 30px auto;
    background: #18181b;
    padding: 36px 40px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.05);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .alp-wrap *,
  .alp-wrap *::before,
  .alp-wrap *::after {
    box-sizing: border-box;
  }

  .alp-title {
    text-align: center;
    color: #f97316;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin: 0 0 20px;
  }

  .alp-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 26px;
  }

  .alp-subtitle {
    color: #f97316;
    margin: 0;
    font-size: 22px;
  }

  .alp-manage-btn {
    padding: 10px 18px;
    border-radius: 7px;
    border: none;
    background: #3f3f46;
    color: #fff;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .alp-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .alp-form > * { min-width: 0; }

  .alp-type-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .alp-type-btn {
    padding: 12px 22px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  }

  .alp-one {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .alp-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .alp-three {
    display: grid;
    grid-template-columns: 1fr 1.3fr 1fr;
    gap: 28px;
  }

  .alp-one > *, .alp-two > *, .alp-three > * { min-width: 0; }

  .alp-one input[type="date"] {
    max-width: 320px;
  }

  .alp-narrow {
    max-width: 320px;
  }

  .alp-card {
    padding: 20px;
    border: 1px solid #27272a;
    border-radius: 10px;
    background: #111113;
  }

  .alp-original {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 16px;
  }

  .alp-original > * { min-width: 0; }

  .alp-summary-card {
    padding: 20px;
    background: #111113;
    border: 1px solid #3f3f46;
    border-radius: 10px;
  }

  .alp-summary {
    display: grid;
    grid-template-columns: repeat(5, minmax(140px, 1fr));
    gap: 12px;
  }

  /* Simple loan: only 3 boxes. Must stay above the media queries below
     so tablet/mobile rules can still override it. */
  .alp-summary-simple {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }

  .alp-submit {
    margin-top: 8px;
    padding: 14px;
    border-radius: 8px;
    border: none;
    color: #fff;
    font-weight: 600;
    font-size: 15px;
    width: 100%;
  }

  .alp-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .alp-modal {
    width: 100%;
    max-width: 440px;
    max-height: 92vh;
    overflow-y: auto;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 12px;
    padding: 26px;
    box-sizing: border-box;
  }

  .alp-modal-actions {
    display: flex;
    gap: 10px;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  input[type="number"] { -moz-appearance: textfield; }

  input[type="date"] {
    min-height: 46px;
    -webkit-appearance: none;
    appearance: none;
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

  /* ---------- Laptop / small desktop ---------- */
  @media (max-width: 1100px) {
    .alp-original { grid-template-columns: 1fr; }
    .alp-summary  { grid-template-columns: repeat(3, minmax(120px, 1fr)); }
  }

  /* ---------- Tablet ---------- */
  @media (max-width: 900px) {
    .alp-wrap { padding: 28px 24px; margin: 20px auto; }
    .alp-three { gap: 16px; grid-template-columns: 1fr 1fr; }
    .alp-three > :first-child { grid-column: 1 / -1; }
  }

  /* ---------- Mobile ---------- */
  @media (max-width: 640px) {
    .alp-wrap {
      margin: 0;
      padding: 18px 14px 24px;
      border-radius: 0;
      border-left: none;
      border-right: none;
      min-height: 100vh;
    }

    .alp-title { font-size: 22px; margin-bottom: 14px; }

    .alp-head {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      margin-bottom: 18px;
    }

    .alp-subtitle { font-size: 18px; text-align: center; }

    .alp-manage-btn {
      width: 100%;
      padding: 12px;
      min-height: 44px;
    }

    .alp-form { gap: 16px; }

    /* Loan type buttons: two equal-width tap targets */
    .alp-type-row { flex-wrap: nowrap; gap: 8px; }
    .alp-type-btn {
      flex: 1;
      padding: 12px 8px;
      min-height: 46px;
      font-size: 13.5px;
    }

    /* Stack all grids */
    .alp-two,
    .alp-three {
      grid-template-columns: 1fr !important;
      gap: 16px;
    }
    .alp-three > :first-child { grid-column: auto; }

    .alp-one input[type="date"],
    .alp-narrow {
      max-width: none;
    }

    /* 16px+ stops iOS Safari from zooming in on focus */
    .alp-wrap input,
    .alp-wrap select,
    .alp-wrap textarea {
      font-size: 16px !important;
      min-height: 46px;
    }

    .alp-wrap textarea { min-height: 0; }

    .alp-card,
    .alp-summary-card { padding: 14px; }

    .alp-summary {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .alp-summary > :last-child { grid-column: 1 / -1; }

    .alp-submit {
      padding: 15px;
      min-height: 50px;
      position: sticky;
      bottom: 10px;
      z-index: 5;
      box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    }

    /* Modal becomes a bottom sheet */
    .alp-overlay { align-items: flex-end; padding: 0; }
    .alp-modal {
      max-width: none;
      border-radius: 14px 14px 0 0;
      padding: 20px 16px calc(20px + env(safe-area-inset-bottom, 0px));
      max-height: 90vh;
    }
    .alp-modal-actions { flex-direction: column-reverse; }
  }

  /* ---------- Very small phones ---------- */
  @media (max-width: 360px) {
    .alp-wrap { padding: 14px 10px 20px; }
    .alp-summary { grid-template-columns: 1fr; }
  }
`;

export default AddLoanProduct;