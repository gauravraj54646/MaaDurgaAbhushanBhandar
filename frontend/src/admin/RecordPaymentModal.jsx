import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const getToday = () => new Date().toISOString().split("T")[0];

// item: { _id, metal, netWeight, remainingWeight, description }
// onSuccess receives the full updated Vyapar document from the server.
const RecordPaymentModal = ({ vyaparId, item, onClose, onSuccess }) => {
  const { user } = useContext(AuthContext);

  const [date, setDate] = useState(getToday());
  const [rate, setRate] = useState("");
  const [fineWeight, setFineWeight] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const remaining = Number(item.remainingWeight ?? item.netWeight ?? 0);
  const fineWeightNum = Number(fineWeight);
  const rateNum = Number(rate);
  const amountNum = Number(amount);

  // Rate is per 10g (confirmed convention) — so amount = fineWeight *
  // rate / 10, and the inverse: fineWeight = amount * 10 / rate.
  // Both weight and amount fields drive each other off whichever the
  // person typed into last, so either "I have this much gold" or
  // "they're paying this much money" works as the starting point.

  const handleFineWeightChange = (value) => {
    setFineWeight(value);

    const w = Number(value);

    if (Number.isFinite(w) && Number.isFinite(rateNum) && rateNum > 0) {
      setAmount(((w * rateNum) / 10).toFixed(2));
    } else {
      setAmount("");
    }
  };

  const handleAmountChange = (value) => {
    setAmount(value);

    const a = Number(value);

    if (Number.isFinite(a) && Number.isFinite(rateNum) && rateNum > 0) {
      setFineWeight(((a * 10) / rateNum).toFixed(3));
    } else {
      setFineWeight("");
    }
  };

  const handleRateChange = (value) => {
    setRate(value);

    const r = Number(value);

    if (!Number.isFinite(r) || r <= 0) return;

    // Re-derive whichever field currently has a value, preferring
    // fine weight as the source of truth if both happen to be set.
    if (fineWeight !== "" && Number.isFinite(fineWeightNum)) {
      setAmount(((fineWeightNum * r) / 10).toFixed(2));
    } else if (amount !== "" && Number.isFinite(amountNum)) {
      setFineWeight(((amountNum * 10) / r).toFixed(3));
    }
  };

  // One-click shortcut: fills fine weight with everything still owed
  // on this item. Reuses handleFineWeightChange so the amount field
  // recalculates the same way it would from manual entry.
  const handleFullPayment = () => {
    if (remaining <= 0.001) return;

    handleFineWeightChange(remaining.toFixed(3));
  };

  const isFullPayment =
    fineWeight !== "" &&
    Number.isFinite(fineWeightNum) &&
    Math.abs(fineWeightNum - remaining) <= 0.001 &&
    remaining > 0.001;

  const validate = () => {
    if (!date) {
      return "Date is required.";
    }

    if (rate === "" || !Number.isFinite(rateNum) || rateNum <= 0) {
      return "Enter a valid rate.";
    }

    if (
      fineWeight === "" ||
      !Number.isFinite(fineWeightNum) ||
      fineWeightNum <= 0
    ) {
      return "Enter a fine weight or amount.";
    }

    if (fineWeightNum > remaining + 0.001) {
      return `Fine weight cannot exceed the remaining weight of ${remaining.toFixed(3)} g.`;
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/vyapars/${vyaparId}/items/${item._id}/fine-payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            date,
            rate: rateNum,
            fineWeight: fineWeightNum,
          }),
        },
      );

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check that the API server is running and the request URL/proxy is correct.`,
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to record payment.");
      }

      onSuccess?.(data);
      onClose();
    } catch (err) {
      console.error("Error recording fine payment:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
      onClick={onClose}
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
          Record Payment
        </div>

        <div
          style={{
            color: "#71717a",
            fontSize: "12.5px",
            marginBottom: "18px",
            textTransform: "capitalize",
          }}
        >
          {item.metal} item — {remaining.toFixed(3)} g remaining
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div>
            <label style={labelStyle}>Date</label>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Rate ({item.metal === "gold" ? "gold" : "silver"}, per 10g)
            </label>

            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 74500"
              value={rate}
              onChange={(e) =>
                handleRateChange(e.target.value.replace(/[^0-9.]/g, ""))
              }
              style={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={handleFullPayment}
            disabled={remaining <= 0.001}
            style={{
              border: "1px dashed rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.08)",
              color: "#22c55e",
              borderRadius: "7px",
              padding: "10px 12px",
              cursor: remaining <= 0.001 ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: "600",
              textAlign: "left",
              opacity: remaining <= 0.001 ? 0.5 : 1,
            }}
          >
            ✓ Full Payment — settle all {remaining.toFixed(3)}g remaining
            {rate && rateNum > 0
              ? ` (₹${((remaining * rateNum) / 10).toFixed(2)} at this rate)`
              : " — enter a rate first to see the amount"}
          </button>

          {isFullPayment && (
            <div
              style={{
                color: "#22c55e",
                fontSize: "12px",
                marginTop: "-6px",
              }}
            >
              This will fully settle the item — nothing will remain owed.
            </div>
          )}

          <div
            style={{
              color: "#71717a",
              fontSize: "11.5px",
              marginTop: "-6px",
            }}
          >
            Or fill in either field below — the other calculates
            automatically.
          </div>

          <div className="two-col-modal" style={twoColStyle}>
            <div>
              <label style={labelStyle}>
                Fine Weight (g) <sub style={subFTagStyle}>F</sub>
              </label>

              <input
                type="text"
                inputMode="decimal"
                placeholder="0.000"
                value={fineWeight}
                onChange={(e) =>
                  handleFineWeightChange(
                    e.target.value.replace(/[^0-9.]/g, ""),
                  )
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Amount (₹)</label>

              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) =>
                  handleAmountChange(e.target.value.replace(/[^0-9.]/g, ""))
                }
                style={inputStyle}
              />
            </div>
          </div>

          {amountNum > 0 && (
            <div
              style={{
                padding: "10px 12px",
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: "7px",
                color: "#22c55e",
                fontSize: "13.5px",
                fontWeight: "600",
              }}
            >
              {fineWeightNum.toFixed(3)}g<sub style={subFTagStyle}>F</sub> = ₹
              {amountNum.toFixed(2)}
            </div>
          )}

          {error && (
            <div style={{ color: "#ef4444", fontSize: "12.5px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #3f3f46",
                background: "transparent",
                color: "#e4e4e7",
                fontWeight: "600",
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: submitting ? "#52525b" : "#f97316",
                color: "#fff",
                fontWeight: "600",
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>

        <style>{`
          @media (max-width: 420px) {
            .two-col-modal {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
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
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#a1a1aa",
  fontSize: "0.9rem",
  fontWeight: "500",
};

const twoColStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
};

const subFTagStyle = {
  color: "#facc15",
  fontWeight: "700",
  fontSize: "10px",
};

export default RecordPaymentModal;