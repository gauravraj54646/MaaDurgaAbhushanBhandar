import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

const AddLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

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
    date.setFullYear(date.getFullYear() + 3);
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
    name: "",
    address: "",
    customerId: "",
    mobileNo: "",
    description: "",
    goldWeight: "",
    silverWeight: "",

    // Original loan issue date
    date: getToday(),

    dueDate: getDueDate(),

    available: "yes",

    roi: 5,

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
  // CALCULATE INTEREST
  // =========================================================

  const calculateLoan = (amount, issueDate) => {
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

    if (!formData.dueDate) {
      errs.dueDate = "Due Date is required.";
    }

    // ROI
    if (formData.roi === "" || Number(formData.roi) < 0) {
      errs.roi = "Enter a valid ROI.";
    }

    // Original loan
    if (formData.loanAmount === "" || Number(formData.loanAmount) < 0) {
      errs.loanAmount = "Enter a valid loan amount.";
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

      const submitData = {
        ...formData,
        goldWeight: Number(formData.goldWeight || 0),

        silverWeight: Number(formData.silverWeight || 0),

        mobileNo: formData.mobileNo.trim() || "9204333944",

        loanAmount: Number(formData.loanAmount),

        roi: Number(formData.roi),

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

      const responseData = await res.json();

      if (res.ok) {
        alert("Loan created successfully!");

        navigate("/admin/loans");
      } else {
        alert(responseData.message || "Error creating loan");
      }
    } catch (error) {
      console.error("Error creating loan:", error);

      alert("Something went wrong while creating the loan.");
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
      <h2
        style={{
          color: "#f97316",
          marginTop: 0,
          marginBottom: "26px",
          fontSize: "22px",
        }}
      >
        Add New Loan
      </h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        {/* =====================================================
            NAME
        ====================================================== */}

        <div>
          <label style={labelStyle}>Name</label>

          <input
            type="text"
            placeholder="Full name"
            required
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
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
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.address} />
        </div>

        {/* =====================================================
            CUSTOMER ID + MOBILE
        ====================================================== */}

        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Customer ID (max 8 characters)</label>

            <input
              type="text"
              placeholder="Customer ID"
              required
              maxLength={8}
              value={formData.customerId}
              onChange={(e) => {
                const value = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 8);

                handleChange("customerId", value);
              }}
              style={inputStyle}
            />

            <FieldError msg={errors.customerId} />
          </div>

          <div>
            <label style={labelStyle}>Mobile No.</label>

            <input
              type="text"
              placeholder="10-digit mobile number"
              required
              maxLength={10}
              value={formData.mobileNo}
              onChange={(e) =>
                handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))
              }
              style={inputStyle}
            />

            <FieldError msg={errors.mobileNo} />
          </div>
        </div>

        {/* =====================================================
            GOLD / SILVER WEIGHT
        ====================================================== */}

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

        {/* =====================================================
            DESCRIPTION
        ====================================================== */}

        <div>
          <label style={labelStyle}>Description</label>

          <textarea
            placeholder="Description of the pledged item(s)"
            required
            rows="4"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <FieldError msg={errors.description} />
        </div>

        {/* =====================================================
            ISSUE DATE + DUE DATE
        ====================================================== */}

        <div className="two-col" style={twoColGridStyle}>
          <div>
            <label style={labelStyle}>Issue Date</label>

            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => handleChange("date", e.target.value)}
              style={{
                ...inputStyle,
                cursor: "pointer",
              }}
            />

            <FieldError msg={errors.date} />
          </div>

          <div>
            <label style={labelStyle}>Due Date</label>

            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              style={{
                ...inputStyle,
                cursor: "pointer",
              }}
            />

            <FieldError msg={errors.dueDate} />
          </div>
        </div>

        {/* =====================================================
            AVAILABLE + ROI
        ====================================================== */}

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
              style={inputStyle}
            />

            <FieldError msg={errors.roi} />
          </div>
        </div>

        {/* =====================================================
            DISSOLVE DATE
        ====================================================== */}

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
            <div>
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

          {formData.loanAmount !== "" && (
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

        {/* =====================================================
            RELOANS
        ====================================================== */}

        <SectionCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: formData.reloans.length ? "16px" : "0",
            }}
          >
            <div>
              <SectionHeader title="Re-Loans" marginBottom="2px" />

              <div
                style={{
                  color: "#71717a",
                  fontSize: "12.5px",
                }}
              >
                {formData.reloans.length}
                /20 added
              </div>
            </div>

            <AddButton
              onClick={addReloan}
              disabled={formData.reloans.length >= 20}
              text="+ Add Reloan"
            />
          </div>

          {formData.reloans.length > 0 && (
            <div className="reloan-header" style={reloanGridStyle}>
              <span>#</span>
              <span>ISSUE DATE</span>
              <span>LOAN AMOUNT</span>
              <span style={{ textAlign: "right" }}>INTEREST</span>
              <span style={{ textAlign: "right" }}>TOTAL</span>
              <span />
            </div>
          )}

          {formData.reloans.map((reloan, index) => {
            const calculation = reloanCalculations[index];

            return (
              <div
                key={reloan.id}
                style={{
                  marginBottom: "10px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid #1f1f23",
                }}
              >
                <div className="reloan-row" style={reloanGridStyle}>
                  <div
                    style={{
                      color: "#a1a1aa",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Issue Date */}
                  <input
                    type="date"
                    value={reloan.issueDate}
                    onChange={(e) =>
                      updateReloan(reloan.id, "issueDate", e.target.value)
                    }
                    style={{
                      ...inputStyle,
                      padding: "10px 8px",
                      fontSize: "13px",
                    }}
                  />

                  {/* Amount */}
                  <div>
                    <MoneyInput
                      placeholder="Amount"
                      value={reloan.amount}
                      onChange={(e) =>
                        updateReloan(reloan.id, "amount", e.target.value)
                      }
                      compact
                    />

                    {reloan.amount && (
                      <div
                        style={{
                          ...amountWordsStyle,
                          fontSize: "10.5px",
                          marginTop: "4px",
                          whiteSpace: "normal",
                        }}
                      >
                        {numberToWords(reloan.amount)}
                      </div>
                    )}
                  </div>

                  {/* Interest */}
                  <div
                    style={{
                      color: "#f59e0b",
                      fontSize: "13px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₹{calculation.interest.toFixed(2)}
                  </div>

                  {/* Total */}
                  <div
                    style={{
                      color: "#22c55e",
                      fontSize: "13px",
                      fontWeight: "600",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₹{calculation.total.toFixed(2)}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeReloan(reloan.id)}
                    title="Remove reloan"
                    style={deleteButtonStyle}
                  >
                    🗑
                  </button>
                </div>

                {errors[`reloanDate_${index}`] && (
                  <SmallError msg={errors[`reloanDate_${index}`]} />
                )}

                {errors[`reloanAmount_${index}`] && (
                  <SmallError msg={errors[`reloanAmount_${index}`]} />
                )}
              </div>
            );
          })}

          {formData.reloans.length === 0 && (
            <div
              style={{
                color: "#52525b",
                fontSize: "13px",
                textAlign: "center",
                padding: "14px",
              }}
            >
              No re-loan added
            </div>
          )}

          {/* Reloan subtotal */}
          {formData.reloans.length > 0 && (
            <div style={subTotalStyle}>
              <span>
                Reloan Amount: <b>₹{reloanAmount.toFixed(2)}</b>
              </span>

              <span>
                Reloan Interest:{" "}
                <b style={{ color: "#f59e0b" }}>₹{reloanInterest.toFixed(2)}</b>
              </span>

              <span>
                Reloan Total:{" "}
                <b style={{ color: "#22c55e" }}>₹{reloanTotal.toFixed(2)}</b>
              </span>
            </div>
          )}
        </SectionCard>

        {/* =====================================================
            PAYMENTS - SEPARATE FROM RELOANS
        ====================================================== */}

        <SectionCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: formData.payments.length ? "16px" : "0",
            }}
          >
            <div>
              <SectionHeader title="Payments" marginBottom="2px" />

              <div
                style={{
                  color: "#71717a",
                  fontSize: "12.5px",
                }}
              >
                Paid amount is deducted from total. Payment date is stored only.
              </div>
            </div>

            <AddButton onClick={addPayment} text="+ Add Payment" />
          </div>

          {formData.payments.length > 0 && (
            <div className="payment-header" style={paymentGridStyle}>
              <span>#</span>
              <span>PAID AMOUNT</span>
              <span>PAID DATE</span>
              <span />
            </div>
          )}

          {formData.payments.map((payment, index) => (
            <div
              key={payment.id}
              style={{
                marginBottom: "10px",
                paddingBottom: "10px",
                borderBottom: "1px solid #1f1f23",
              }}
            >
              <div className="payment-row" style={paymentGridStyle}>
                <div
                  style={{
                    color: "#a1a1aa",
                    fontSize: "13px",
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </div>

                {/* Paid Amount */}
                <div>
                  <MoneyInput
                    placeholder="Paid Amount"
                    value={payment.paidAmount}
                    onChange={(e) =>
                      updatePayment(payment.id, "paidAmount", e.target.value)
                    }
                    compact
                  />

                  {payment.paidAmount && (
                    <div
                      style={{
                        ...amountWordsStyle,
                        fontSize: "10.5px",
                        marginTop: "4px",
                        whiteSpace: "normal",
                      }}
                    >
                      {numberToWords(payment.paidAmount)}
                    </div>
                  )}
                </div>
                {/* Paid Date */}
                <input
                  type="date"
                  value={payment.paidDate}
                  onChange={(e) =>
                    updatePayment(payment.id, "paidDate", e.target.value)
                  }
                  style={{
                    ...inputStyle,
                    padding: "10px 8px",
                    fontSize: "13px",
                  }}
                />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removePayment(payment.id)}
                  title="Remove payment"
                  style={deleteButtonStyle}
                >
                  🗑
                </button>
              </div>

              {errors[`paymentAmount_${index}`] && (
                <SmallError msg={errors[`paymentAmount_${index}`]} />
              )}

              {errors[`paymentDate_${index}`] && (
                <SmallError msg={errors[`paymentDate_${index}`]} />
              )}
            </div>
          ))}

          {formData.payments.length === 0 && (
            <div
              style={{
                color: "#52525b",
                fontSize: "13px",
                textAlign: "center",
                padding: "14px",
              }}
            >
              No payment added
            </div>
          )}

          {formData.payments.length > 0 && (
            <div
              style={{
                ...subTotalStyle,
                borderTop: "1px solid #27272a",
                marginTop: "8px",
                paddingTop: "12px",
              }}
            >
              <span>
                Total Paid:{" "}
                <b style={{ color: "#ef4444" }}>₹{totalPaid.toFixed(2)}</b>
              </span>
            </div>
          )}

          {errors.payments && <SmallError msg={errors.payments} />}
        </SectionCard>

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
            Final Loan Summary
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

export default AddLoanProduct;
