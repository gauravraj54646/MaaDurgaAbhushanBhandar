import React, { useEffect, useState, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";

// =========================================================
// HELPERS
// =========================================================

const wordCount = (str = "") => str.trim().split(/\s+/).filter(Boolean).length;

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return "-";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const numberToWords = (num) => {
  num = Number(num);
  if (!Number.isFinite(num) || num === 0) return "";

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
  if (integerPart >= 1000000000) return "Amount Too Large";

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

const EditLoanProduct = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // -----------------------------------------------------------
  // Refs (for scroll-to-error on invalid submit)
  // -----------------------------------------------------------
  const fieldRefs = useRef({});

  // -----------------------------------------------------------
  // Lock / unlock gate — nothing is editable until the admin
  // password is verified once, right after the loan loads.
  // -----------------------------------------------------------
  const [unlocked, setUnlocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // -----------------------------------------------------------
  // Loan data
  // -----------------------------------------------------------
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    customerId: "",
    loanId: "",
    mobileNo: "",
    description: "",
    goldWeight: "",
    silverWeight: "",

    // Locked — set at creation, never editable here
    date: "",
    loanAmount: "",
    interest: "",
    totalAmount: "",

    dueDate: "",
    available: "yes",
    roi: 5,
    returnDate: "",
    dissolveDate: "",

    signed: "no",
    finalSettlement: "",

    reloans: [],
    payments: [],
  });

  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Save-time password confirmation (second gate, after editing)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Delete-row confirmation (password-gated, same pattern as save) —
  // fires when removing a reloan or payment row
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'reloan' | 'payment', id, label }
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
  if (!unlocked) {
    document.body.style.overflow = "hidden";
  }
  return () => {
    document.body.style.overflow = "";
  };
}, [unlocked]);
  // -----------------------------------------------------------
  // Fetch loan
  // -----------------------------------------------------------
  useEffect(() => {
    const fetchLoan = async () => {
      setFetching(true);
      setFetchError("");
      try {
        const res = await fetch(`/api/loans/${id}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to load loan.");
        }

        setFormData({
          name: data.name || "",
          address: data.address || "",
          customerId: data.customerId || "",
          loanId: data.loanId || "",
          mobileNo: data.mobileNo || "",
          description: data.description || "",
          goldWeight: data.goldWeight ?? "",
          silverWeight: data.silverWeight ?? "",

          date: data.date ? data.date.substring(0, 10) : "",
          loanAmount: data.loanAmount ?? "",
          interest: data.interest ?? "",
          totalAmount: data.totalAmount ?? "",

          dueDate: data.dueDate ? data.dueDate.substring(0, 10) : "",
          available: data.available || "yes",
          roi: data.roi ?? 5,
          returnDate: data.returnDate ? data.returnDate.substring(0, 10) : "",
          dissolveDate: data.dissolveDate
            ? data.dissolveDate.substring(0, 10)
            : "",

          signed: data.signed || "no",
          finalSettlement: data.finalSettlement || "",

          reloans: (data.reloans || []).map((r, i) => ({
            id: r._id || `reloan_${i}_${Date.now()}`,
            issueDate: r.issueDate ? r.issueDate.substring(0, 10) : "",
            amount: r.amount ?? "",
          })),

          payments: (data.payments || []).map((p, i) => ({
            id: p._id || `payment_${i}_${Date.now()}`,
            paidAmount: p.paidAmount ?? "",
            paidDate: p.paidDate ? p.paidDate.substring(0, 10) : "",
          })),
        });
      } catch (err) {
        console.error("Error fetching loan:", err);
        setFetchError(err.message || "Something went wrong while loading the loan.");
      } finally {
        setFetching(false);
      }
    };

    fetchLoan();
  }, [id, user]);

  // -----------------------------------------------------------
  // Interest calc (same formula used on Add Loan) — used only for
  // the still-editable reloans. The original loan's interest/total
  // stay exactly as stored, since the original loan is locked.
  // -----------------------------------------------------------
  const calculateLoan = (amount, issueDate) => {
    if (
      amount === "" || amount === null || amount === undefined ||
      !issueDate ||
      formData.roi === "" || formData.roi === null || formData.roi === undefined
    ) {
      return { days: 0, interest: 0, total: 0 };
    }

    const loanAmount = Number(amount);
    const roi = Number(formData.roi);

    if (!Number.isFinite(loanAmount) || !Number.isFinite(roi) || loanAmount < 0) {
      return { days: 0, interest: 0, total: 0 };
    }

    const loanDate = new Date(issueDate);
    const today = new Date();
    loanDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const differenceInTime = today.getTime() - loanDate.getTime();
    const differenceInDays = Math.max(30, Math.floor(differenceInTime / (1000 * 60 * 60 * 24)));

    const interest = (loanAmount * roi * differenceInDays) / 3000;
    const total = loanAmount + interest;

    return { days: differenceInDays, interest, total };
  };

  const reloanCalculations = formData.reloans.map((r) =>
    calculateLoan(r.amount, r.issueDate)
  );

  const reloanAmount = formData.reloans.reduce(
    (sum, r) => sum + Number(r.amount || 0), 0
  );
  const reloanInterest = reloanCalculations.reduce((sum, c) => sum + c.interest, 0);
  const reloanTotal = reloanCalculations.reduce((sum, c) => sum + c.total, 0);

  // Original loan's interest/total are recalculated live off the locked
  // loanAmount + date + roi — same formula Add Loan uses — instead of
  // showing whatever interest/totalAmount happened to be stored at
  // creation time (which would otherwise never account for days that
  // have passed since).
  const originalLoan = calculateLoan(formData.loanAmount, formData.date);

  const grandLoanAmount = Number(formData.loanAmount || 0) + reloanAmount;
  const grandInterest = originalLoan.interest + reloanInterest;
  const grandTotal = originalLoan.total + reloanTotal;

  const totalPaid = formData.payments.reduce(
    (sum, p) => sum + Number(p.paidAmount || 0), 0
  );

  const finalAmount = grandTotal - totalPaid;

  // -----------------------------------------------------------
  // Field handlers
  // -----------------------------------------------------------
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const addReloan = () => {
    if (formData.reloans.length >= 20) {
      alert("Maximum 20 re-loans are allowed.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      reloans: [
        ...prev.reloans,
        { id: `new_${Date.now()}`, issueDate: new Date().toISOString().split("T")[0], amount: "" },
      ],
    }));
  };

  const removeReloan = (id) => {
    setFormData((prev) => ({
      ...prev,
      reloans: prev.reloans.filter((r) => r.id !== id),
    }));
  };

  const updateReloan = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      reloans: prev.reloans.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  };

  const addPayment = () => {
    setFormData((prev) => ({
      ...prev,
      payments: [
        ...prev.payments,
        { id: `new_${Date.now()}`, paidAmount: "", paidDate: new Date().toISOString().split("T")[0] },
      ],
    }));
  };

  const removePayment = (id) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== id),
    }));
  };

  const updatePayment = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      payments: prev.payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  // -----------------------------------------------------------
  // Scroll / focus to first invalid field
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // Validation — only the fields that are actually editable here
  // -----------------------------------------------------------
  const validate = () => {
    const errs = {};

    if (!formData.name.trim()) errs.name = "Name is required.";
    if (wordCount(formData.name) > 60) errs.name = "Name must be 60 words or fewer.";

    if (!formData.address.trim()) errs.address = "Address is required.";
    if (wordCount(formData.address) > 100) errs.address = "Address must be 100 words or fewer.";

    if (formData.mobileNo && !/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = "Mobile No. must be exactly 10 digits.";
    }

    if (!formData.description.trim()) errs.description = "Description is required.";
    if (wordCount(formData.description) > 300) errs.description = "Description must be 300 words or fewer.";

    if (!formData.dueDate) errs.dueDate = "Due Date is required.";

    if (formData.roi === "" || Number(formData.roi) < 0) errs.roi = "Enter a valid ROI.";

    formData.reloans.forEach((r, index) => {
      if (!r.issueDate) errs[`reloanDate_${index}`] = `Issue date is required for Reloan ${index + 1}.`;
      if (r.amount === "" || Number(r.amount) < 0) {
        errs[`reloanAmount_${index}`] = `Enter a valid amount for Reloan ${index + 1}.`;
      }
    });

    let paidBeforeCurrent = 0;
    formData.payments.forEach((p, index) => {
      const paidAmount = Number(p.paidAmount || 0);
      const remainingBeforePayment = grandTotal - paidBeforeCurrent;

      if (p.paidAmount === "" || paidAmount <= 0) {
        errs[`paymentAmount_${index}`] = `Enter a valid payment amount for Payment ${index + 1}.`;
      } else if (paidAmount > remainingBeforePayment) {
        errs[`paymentAmount_${index}`] = `Payment cannot exceed the remaining amount of ₹${remainingBeforePayment.toFixed(2)}.`;
      }

      if (!p.paidDate) errs[`paymentDate_${index}`] = `Payment date is required for Payment ${index + 1}.`;

      paidBeforeCurrent += paidAmount;
    });

    const enteredPaidAmount = formData.payments.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0), 0
    );
    if (enteredPaidAmount > grandTotal) {
      errs.payments = "Total paid amount cannot exceed the total loan amount.";
    }

    if (formData.finalSettlement && wordCount(formData.finalSettlement) > 100) {
      errs.finalSettlement = "Final Settlement must be 100 words or fewer.";
    }

    // Return Date validation
// Return Date is allowed only when:
// 1. At least one payment has been made, and
// 2. Total paid amount is greater than or equal to
//    Original Loan Amount + Total Reloan Amount.
if (formData.returnDate) {
  if (enteredPaidAmount <= 0) {
    errs.returnDate =
      "Return Date cannot be added because no payment has been made.";
  } else if (enteredPaidAmount < grandLoanAmount) {
    errs.returnDate =
      `Return Date can only be added when total payment is at least ` +
      `Loan Amount + Reloan Amount (₹${grandLoanAmount.toFixed(2)}).`;
  }
}

    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
    }

    return Object.keys(errs).length === 0;
  };

  // -----------------------------------------------------------
  // Unlock gate (password #1 — required before any field can be edited)
  // -----------------------------------------------------------
  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPassword) {
      setUnlockError("Enter your password.");
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      // Reuses the same password-check endpoint as the "More Info"
      // financials panel on the Manage Loans page — that one is known
      // to work against the current backend.
      const res = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: unlockPassword }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (status ${res.status}).`);
      }

      const data = await res.json();

      if (!res.ok) {
        setUnlockError(data.message || "Incorrect password. Please try again.");
        setUnlocking(false);
        return;
      }

      setUnlocked(true);
      setUnlockPassword("");
    } catch (err) {
      console.error(err);
      setUnlockError(err.message || "Something went wrong verifying your password.");
    } finally {
      setUnlocking(false);
    }
  };

  // -----------------------------------------------------------
  // Submit gate (password #2 — required again before saving)
  // -----------------------------------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setConfirmError("");
    setConfirmPassword("");
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!confirmPassword) {
      setConfirmError("Password is required.");
      return;
    }
    setConfirming(true);
    setConfirmError("");
    try {
      const verifyRes = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: confirmPassword }),
      });

      const verifyContentType = verifyRes.headers.get("content-type") || "";
      if (!verifyContentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (status ${verifyRes.status}).`);
      }

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setConfirmError(verifyData.message || "Incorrect password. Please try again.");
        setConfirming(false);
        return;
      }

      setLoading(true);

      const cleanedReloans = formData.reloans.map((r) => {
        const calc = calculateLoan(r.amount, r.issueDate);
        return {
          issueDate: r.issueDate,
          amount: Number(r.amount),
          interest: Number(calc.interest.toFixed(2)),
          totalAmount: Number(calc.total.toFixed(2)),
        };
      });

      const cleanedPayments = formData.payments.map((p) => ({
        paidAmount: Number(p.paidAmount),
        paidDate: p.paidDate,
      }));

      // Locked fields (customerId, date, loanAmount/interest/totalAmount)
      // are sent back unchanged so the backend record stays consistent.
      const payload = {
        name: formData.name,
        address: formData.address,
        customerId: formData.customerId,
        loanId: formData.loanId,     
        mobileNo: formData.mobileNo,
        description: formData.description,
        goldWeight: Number(formData.goldWeight || 0),
        silverWeight: Number(formData.silverWeight || 0),

        date: formData.date,
        loanAmount: Number(formData.loanAmount),
        interest: Number(originalLoan.interest.toFixed(2)),
        totalAmount: Number(originalLoan.total.toFixed(2)),

        dueDate: formData.dueDate,
        available: formData.available,
        roi: Number(formData.roi),
        returnDate: formData.returnDate,
        dissolveDate: formData.dissolveDate,

        signed: formData.signed,
        finalSettlement: formData.finalSettlement,

        reloans: cleanedReloans,
        payments: cleanedPayments,
      };

      const res = await fetch(`/api/loans/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (status ${res.status}).`);
      }

      const responseData = await res.json();

      if (res.ok) {
        alert("Loan updated successfully!");
        navigate("/admin/loan/products");
      } else {
        alert(responseData.message || "Failed to update loan. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setConfirmError("Something went wrong saving the loan.");
    } finally {
      setConfirming(false);
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  // -----------------------------------------------------------
  // Delete gate (password-confirmed removal of a reloan/payment row)
  // -----------------------------------------------------------
  const requestDeleteReloan = (id, label) => {
    setDeleteTarget({ type: "reloan", id, label });
    setDeletePassword("");
    setDeleteError("");
  };

  const requestDeletePayment = (id, label) => {
    setDeleteTarget({ type: "payment", id, label });
    setDeletePassword("");
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError("Password is required.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (status ${res.status}).`);
      }

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.message || "Incorrect password. Please try again.");
        setDeleting(false);
        return;
      }

      if (deleteTarget.type === "reloan") {
        removeReloan(deleteTarget.id);
      } else if (deleteTarget.type === "payment") {
        removePayment(deleteTarget.id);
      }

      setDeleteTarget(null);
      setDeletePassword("");
    } catch (err) {
      console.error(err);
      setDeleteError(err.message || "Something went wrong verifying your password.");
    } finally {
      setDeleting(false);
    }
  };

  // -----------------------------------------------------------
  // Admin check
  // -----------------------------------------------------------
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  if (fetching) {
    return (
      <div style={pageWrapStyle}>
        <div style={{ ...emptyStateStyle, marginTop: "40px" }}>Loading loan...</div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={pageWrapStyle}>
        <div style={{ ...emptyStateStyle, color: "#ef4444", marginTop: "40px" }}>
          {fetchError}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Gate: unlock screen shown before any field is editable
  // -----------------------------------------------------------
 
  if (!unlocked) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        background: "#000", // match your page background
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "12px",
          padding: "32px",
          boxSizing: "border-box",
          transform: "translateY(40px)", // nudge slightly below true center
        }}
      >
          <div style={{ color: "#f97316", fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
            Confirm Admin Password
          </div>
          <div style={{ color: "#71717a", fontSize: "12.5px", marginBottom: "20px" }}>
            Enter your admin password to unlock editing for{" "}
            <b style={{ color: "#e4e4e7" }}>{formData.name || "this loan"}</b>.
          </div>

          <form onSubmit={handleUnlock}>
            <input
              type="password"
              placeholder="Admin password"
              autoFocus
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              style={inputStyle}
            />
            <FieldError msg={unlockError} />

            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button
                type="button"
                onClick={() => navigate("/admin/loan/products")}
                disabled={unlocking}
                style={cancelBtnStyle}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unlocking}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: unlocking ? "#52525b" : "#f97316",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: unlocking ? "not-allowed" : "pointer",
                }}
              >
                {unlocking ? "Verifying..." : "Unlock & Edit"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // UI — full edit form
  // -----------------------------------------------------------
  return (
    <div style={pageWrapStyle}>
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
          <h1 style={{ color: "#f1990b", margin: 0, fontSize: "28px" }}>Edit Loan</h1>

          <button
            type="button"
            onClick={() => navigate("/admin/loan/products")}
            style={{
              padding: "10px 18px",
              borderRadius: "7px",
              border: "none",
              background: "#3f3f46",
              color: "#f1998b",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📄 Manage Loans
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* NAME */}
          <div>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              placeholder="Full name"
              required
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              ref={(el) => (fieldRefs.current.name = el)}
              style={inputStyle}
            />
            <FieldError msg={errors.name} />
          </div>

          {/* ADDRESS */}
          <div>
            <label style={labelStyle}>Address</label>
            <textarea
              placeholder="Address"
              required
              rows="2"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              ref={(el) => (fieldRefs.current.address = el)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <FieldError msg={errors.address} />
          </div>

          {/* CUSTOMER ID (locked) + MOBILE */}
          <div className="three-col" style={threeColGridStyle}>
            <div>
              <label style={labelStyle}>Customer ID (locked)</label>
              <input
                type="text"
                value={formData.customerId}
                readOnly
                title="Customer ID cannot be changed"
                style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.6 }}
              />
            </div>

            <div>
              <label style={labelStyle}>Mobile No.</label>
              <input
                type="text"
                placeholder="10-digit mobile number"
                maxLength={10}
                value={formData.mobileNo}
                onChange={(e) => handleChange("mobileNo", e.target.value.replace(/[^0-9]/g, ""))}
                ref={(el) => (fieldRefs.current.mobileNo = el)}
                style={inputStyle}
              />
              <FieldError msg={errors.mobileNo} />
            </div>

                      {/* loan ID (locked) + MOBILE */}
         
            <div>
              <label style={labelStyle}>Loan ID (locked)</label>
              <input
                type="text"
                value={formData.loanId}
                readOnly
                title="Loan ID cannot be changed"
                style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.6 }}
              />
            </div>
          </div>

          {/* GOLD / SILVER WEIGHT */}
          <div className="two-col" style={twoColGridStyle}>
            <div>
              <label style={labelStyle}>Gold Weight (g)</label>
              <input
                type="text"
                inputMode="numeric"
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
                placeholder="Silver weight in grams"
                value={formData.silverWeight}
                onChange={(e) => handleChange("silverWeight", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Description of the pledged item(s)"
              required
              rows="4"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              ref={(el) => (fieldRefs.current.description = el)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <FieldError msg={errors.description} />
          </div>

          {/* ISSUE DATE (locked) + DUE DATE */}
          <div className="two-col" style={twoColGridStyle}>
            <div>
              <label style={labelStyle}>Issue Date (locked)</label>
              <input
                type="date"
                value={formData.date}
                readOnly
                disabled
                title="Issue date cannot be changed"
                style={{ ...inputStyle, cursor: "not-allowed", opacity: 0.6 }}
              />
            </div>

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
          </div>

          {/* AVAILABLE + ROI */}
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
                value={formData.roi}
                onChange={(e) => handleChange("roi", e.target.value)}
                ref={(el) => (fieldRefs.current.roi = el)}
                style={inputStyle}
              />
              <FieldError msg={errors.roi} />
            </div>
          </div>

          {/* RETURN DATE + DISSOLVE DATE */}
          <div className="two-col" style={twoColGridStyle}>
            <div ref={(el) => (fieldRefs.current.returnDate = el)}>
              <label style={labelStyle}>Return Date</label>
              <input
                type="date"
                value={formData.returnDate}
                onChange={(e) => handleChange("returnDate", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              />
              <FieldError msg={errors.returnDate} />

{!formData.returnDate && totalPaid < grandLoanAmount && (
  <div
    style={{
      color: "#71717a",
      fontSize: "11px",
      marginTop: "5px",
      lineHeight: 1.4,
    }}
  >
    Return Date will be valid after total payment reaches{" "}
    <b style={{ color: "#f59e0b" }}>
      ₹{grandLoanAmount.toFixed(2)}
    </b>{" "}
    (Loan + Reloan).
  </div>
)}
            </div>
            <div>
              <label style={labelStyle}>Dissolve Date</label>
              <input
                type="date"
                value={formData.dissolveDate}
                onChange={(e) => handleChange("dissolveDate", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              />
            </div>
          </div>

          {/* ORIGINAL LOAN (locked) */}
          <SectionCard>
            <SectionHeader title="Original Loan (locked)" />
            <div
              className="original-loan-grid"
              style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "16px" }}
            >
              <div>
                <label style={smallLabelStyle}>Loan Amount</label>
                <ReadOnlyMoneyInput value={formData.loanAmount !== "" ? Number(formData.loanAmount).toFixed(2) : ""} />
                {formData.loanAmount && (
                  <div style={amountWordsStyle}>{numberToWords(formData.loanAmount)}</div>
                )}
              </div>
              <div>
                <label style={smallLabelStyle}>Interest</label>
                <ReadOnlyMoneyInput value={formData.loanAmount !== "" ? originalLoan.interest.toFixed(2) : ""} />
              </div>
              <div>
                <label style={smallLabelStyle}>Total Amount</label>
                <ReadOnlyMoneyInput value={formData.loanAmount !== "" ? originalLoan.total.toFixed(2) : ""} />
              </div>
            </div>
            <div style={{ marginTop: "10px", color: "#71717a", fontSize: "12.5px" }}>
              Loan date and amount are fixed at creation. Interest and total
              above are recalculated live for{" "}
              <b style={{ color: "#f59e0b" }}>{originalLoan.days}</b> days
              elapsed since the issue date.
            </div>
          </SectionCard>

          {/* RELOANS */}
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
                <div style={{ color: "#71717a", fontSize: "12.5px" }}>
                  {formData.reloans.length}/20 added
                </div>
              </div>
              <AddButton onClick={addReloan} disabled={formData.reloans.length >= 20} text="+ Add Reloan" />
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

            {formData.reloans.map((r, index) => {
              const calc = reloanCalculations[index];
              return (
                <div
                  key={r.id}
                  ref={(el) => {
                    fieldRefs.current[`reloanDate_${index}`] = el;
                    fieldRefs.current[`reloanAmount_${index}`] = el;
                  }}
                  style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1f1f23" }}
                >
                  <div className="reloan-row" style={reloanGridStyle}>
                    <div style={{ color: "#a1a1aa", fontSize: "13px", textAlign: "center" }}>{index + 1}</div>

                    <input
                      type="date"
                      value={r.issueDate}
                      onChange={(e) => updateReloan(r.id, "issueDate", e.target.value)}
                      style={{ ...inputStyle, padding: "10px 8px", fontSize: "13px" }}
                    />

                    <div>
                      <MoneyInput
                        placeholder="Amount"
                        value={r.amount}
                        onChange={(e) => updateReloan(r.id, "amount", e.target.value)}
                        compact
                      />
                      {r.amount && (
                        <div style={{ ...amountWordsStyle, fontSize: "10.5px", marginTop: "4px", whiteSpace: "normal" }}>
                          {numberToWords(r.amount)}
                        </div>
                      )}
                    </div>

                    <div style={{ color: "#f59e0b", fontSize: "13px", textAlign: "right", whiteSpace: "nowrap" }}>
                      ₹{calc.interest.toFixed(2)}
                    </div>

                    <div style={{ color: "#22c55e", fontSize: "13px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                      ₹{calc.total.toFixed(2)}
                    </div>

                    <button type="button" onClick={() => requestDeleteReloan(r.id, `Reloan ${index + 1}`)} title="Remove reloan" style={deleteButtonStyle}>
                      🗑
                    </button>
                  </div>

                  {errors[`reloanDate_${index}`] && <SmallError msg={errors[`reloanDate_${index}`]} />}
                  {errors[`reloanAmount_${index}`] && <SmallError msg={errors[`reloanAmount_${index}`]} />}
                </div>
              );
            })}

            {formData.reloans.length === 0 && (
              <div style={{ color: "#52525b", fontSize: "13px", textAlign: "center", padding: "14px" }}>
                No re-loan added
              </div>
            )}

            {formData.reloans.length > 0 && (
              <div style={subTotalStyle}>
                <span>Reloan Amount: <b>₹{reloanAmount.toFixed(2)}</b></span>
                <span>Reloan Interest: <b style={{ color: "#f59e0b" }}>₹{reloanInterest.toFixed(2)}</b></span>
                <span>Reloan Total: <b style={{ color: "#22c55e" }}>₹{reloanTotal.toFixed(2)}</b></span>
              </div>
            )}
          </SectionCard>

          {/* PAYMENTS */}
          <div ref={(el) => (fieldRefs.current.payments = el)}>
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
                <div style={{ color: "#71717a", fontSize: "12.5px" }}>
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

            {formData.payments.map((p, index) => (
              <div
                key={p.id}
                ref={(el) => {
                  fieldRefs.current[`paymentAmount_${index}`] = el;
                  fieldRefs.current[`paymentDate_${index}`] = el;
                }}
                style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1f1f23" }}
              >
                <div className="payment-row" style={paymentGridStyle}>
                  <div style={{ color: "#a1a1aa", fontSize: "13px", textAlign: "center" }}>{index + 1}</div>

                  <div>
                    <MoneyInput
                      placeholder="Paid Amount"
                      value={p.paidAmount}
                      onChange={(e) => updatePayment(p.id, "paidAmount", e.target.value)}
                      compact
                    />
                    {p.paidAmount && (
                      <div style={{ ...amountWordsStyle, fontSize: "10.5px", marginTop: "4px", whiteSpace: "normal" }}>
                        {numberToWords(p.paidAmount)}
                      </div>
                    )}
                  </div>

                  <input
                    type="date"
                    value={p.paidDate}
                    onChange={(e) => updatePayment(p.id, "paidDate", e.target.value)}
                    style={{ ...inputStyle, padding: "10px 8px", fontSize: "13px" }}
                  />

                  <button type="button" onClick={() => requestDeletePayment(p.id, `Payment ${index + 1}`)} title="Remove payment" style={deleteButtonStyle}>
                    🗑
                  </button>
                </div>

                {errors[`paymentAmount_${index}`] && <SmallError msg={errors[`paymentAmount_${index}`]} />}
                {errors[`paymentDate_${index}`] && <SmallError msg={errors[`paymentDate_${index}`]} />}
              </div>
            ))}

            {formData.payments.length === 0 && (
              <div style={{ color: "#52525b", fontSize: "13px", textAlign: "center", padding: "14px" }}>
                No payment added
              </div>
            )}

            {formData.payments.length > 0 && (
              <div style={{ ...subTotalStyle, borderTop: "1px solid #27272a", marginTop: "8px", paddingTop: "12px" }}>
                <span>Total Paid: <b style={{ color: "#ef4444" }}>₹{totalPaid.toFixed(2)}</b></span>
              </div>
            )}

            {errors.payments && <SmallError msg={errors.payments} />}
          </SectionCard>
          </div>

          {/* FINAL SUMMARY */}
          <div style={{ padding: "20px", background: "#111113", border: "1px solid #3f3f46", borderRadius: "10px" }}>
            <div style={{ color: "#f97316", fontSize: "15px", fontWeight: 600, marginBottom: "14px" }}>
              Final Loan Summary
            </div>
            <div
              className="summary-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(140px, 1fr))", gap: "12px" }}
            >
              <SummaryBox label="Loan Amount" value={grandLoanAmount} />
              <SummaryBox label="Interest" value={grandInterest} color="#f59e0b" />
              <SummaryBox label="Total Amount" value={grandTotal} />
              <SummaryBox label="Total Paid" value={totalPaid} color="#ef4444" />
              <SummaryBox label="FINAL AMOUNT" value={finalAmount} color="#22c55e" large />
            </div>
          </div>

          {/* SIGNED */}
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

          {/* FINAL SETTLEMENT */}
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

          {/* SUBMIT */}
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
              fontWeight: 600,
              fontSize: "15px",
            }}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* SAVE CONFIRMATION MODAL — password #2 */}
        {showConfirmModal && (
          <div style={overlayStyle} onClick={() => !confirming && setShowConfirmModal(false)}>
            <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
              <h3 style={{ color: "#f97316", marginBottom: "10px" }}>Confirm Admin Password</h3>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "15px" }}>
                Enter your admin password to save these changes.
              </p>
              <input
                type="password"
                placeholder="Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoFocus
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmSave()}
              />
              <FieldError msg={confirmError} />
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={confirming}
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={confirming}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: confirming ? "#52525b" : "#f97316",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: confirming ? "not-allowed" : "pointer",
                  }}
                >
                  {confirming ? "Verifying..." : "Confirm & Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL — password-gated row removal */}
        {deleteTarget && (
          <div style={overlayStyle} onClick={() => !deleting && setDeleteTarget(null)}>
            <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
              <h3 style={{ color: "#ef4444", marginBottom: "10px" }}>Confirm Deletion</h3>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "15px" }}>
                Enter your admin password to remove <b style={{ color: "#e4e4e7" }}>{deleteTarget.label}</b>. This cannot be undone.
              </p>
              <input
                type="password"
                placeholder="Password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmDelete()}
              />
              <FieldError msg={deleteError} />
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "8px",
                    border: "none",
                    background: deleting ? "#52525b" : "#ef4444",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: deleting ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting ? "Verifying..." : "Confirm & Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            opacity: 0.7;
          }

          input:focus, textarea:focus, select:focus {
            border-color: #f97316 !important;
          }

          @media (max-width: 1100px) {
            .original-loan-grid { grid-template-columns: 1fr !important; }
            .summary-grid { grid-template-columns: repeat(3, minmax(120px, 1fr)) !important; }
          }

          @media (max-width: 900px) {
            .two-col { grid-template-columns: 1fr !important; }
            .reloan-row, .reloan-header {
              grid-template-columns: 26px 1.1fr 1fr 95px 105px 30px !important;
              gap: 6px !important;
            }
          }

          @media (max-width: 640px) {
            .summary-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)) !important; }
            .payment-row, .payment-header {
              grid-template-columns: 24px 1fr 1fr 28px !important;
              gap: 6px !important;
            }
          }

          @media (max-width: 560px) {
            .reloan-row, .reloan-header {
              grid-template-columns: 22px 1fr 1fr 78px 88px 26px !important;
              gap: 4px !important;
              font-size: 11px;
            }
            .summary-grid { grid-template-columns: 1fr 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
};

// =========================================================
// SMALL COMPONENTS
// =========================================================

const SectionCard = ({ children }) => (
  <div style={{ padding: "20px", border: "1px solid #27272a", borderRadius: "10px", background: "#111113" }}>
    {children}
  </div>
);

const SectionHeader = ({ title, marginBottom = "12px" }) => (
  <div style={{ color: "#f97316", fontSize: "15px", fontWeight: 600, marginBottom }}>{title}</div>
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
        const v = e.target.value.replace(/\D/g, "");
        onChange({ target: { value: v } });
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

const ReadOnlyMoneyInput = ({ value }) => (
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
      value={value}
      style={{ ...inputStyle, paddingLeft: "30px", cursor: "not-allowed", opacity: 0.85 }}
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
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </button>
);

const SummaryBox = ({ label, value, color = "#fff", large = false }) => (
  <div style={{ padding: "14px 12px", background: "#09090b", borderRadius: "8px", border: "1px solid #27272a", minWidth: 0 }}>
    <div
      style={{
        color: "#a1a1aa",
        fontSize: "11px",
        fontWeight: 600,
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
    <div style={{ color, fontSize: large ? "19px" : "15px", fontWeight: 700, wordBreak: "break-word" }}>
      ₹{Number(value || 0).toFixed(2)}
    </div>
  </div>
);

const FieldError = ({ msg }) =>
  msg ? <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "5px 0 0" }}>{msg}</p> : null;

const SmallError = ({ msg }) =>
  msg ? <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px", marginLeft: "32px" }}>{msg}</div> : null;

// =========================================================
// STYLES
// =========================================================

const pageWrapStyle = { minHeight: "100vh" };

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
  fontWeight: 500,
};

const smallLabelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#71717a",
  fontSize: "11.5px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const twoColGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
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

const amountWordsStyle = {
  color: "#a1a1aa",
  fontSize: "12px",
  marginTop: "5px",
  lineHeight: "1.4",
  fontStyle: "italic",
};

const emptyStateStyle = {
  padding: "40px 18px",
  textAlign: "center",
  color: "#52525b",
  fontSize: "13px",
};

const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px",
};

const modalStyle = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "12px",
  padding: "30px",
  width: "90%",
  maxWidth: "380px",
  boxSizing: "border-box",
};

const cancelBtnStyle = {
  flex: "0 0 auto",
  padding: "12px 16px",
  background: "transparent",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#a1a1aa",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "14px",
};

export default EditLoanProduct;