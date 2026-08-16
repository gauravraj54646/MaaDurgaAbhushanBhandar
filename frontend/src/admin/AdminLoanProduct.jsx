import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const PAGE_SIZE = 20;

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

const AdminLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "More Info" panel — password-gated financial totals
  const [showFinancials, setShowFinancials] = useState(false);
  const [financialsPassword, setFinancialsPassword] = useState("");
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState("");
  const [financials, setFinancials] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters — controlled inputs; committed to actual query params
  // via a short debounce so we don't fire a request on every keystroke.
  const [nameInput, setNameInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    name: "",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
  });

  // Default: newest loan first ("now to before date")
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // -----------------------------------------------------------
  // Debounce text/number filter inputs -> appliedFilters
  // -----------------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setAppliedFilters({
        name: nameInput.trim(),
        fromDate: fromDateInput,
        toDate: toDateInput,
        minAmount: minAmountInput,
        maxAmount: maxAmountInput,
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [nameInput, fromDateInput, toDateInput, minAmountInput, maxAmountInput]);

  // -----------------------------------------------------------
  // Fetch loans whenever page / filters / sort changes
  // -----------------------------------------------------------
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("page", page);
      params.set("limit", PAGE_SIZE);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (appliedFilters.name) params.set("name", appliedFilters.name);
      if (appliedFilters.fromDate) params.set("fromDate", appliedFilters.fromDate);
      if (appliedFilters.toDate) params.set("toDate", appliedFilters.toDate);
      if (appliedFilters.minAmount) params.set("minAmount", appliedFilters.minAmount);
      if (appliedFilters.maxAmount) params.set("maxAmount", appliedFilters.maxAmount);

      const res = await fetch(`/api/loans?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check the API server is running.`,
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load loans.");
      }

      setLoans(data.loans || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching loans:", err);
      setError(err.message || "Something went wrong while loading loans.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, appliedFilters, user]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // -----------------------------------------------------------
  // Sorting — clicking a column header toggles asc/desc; a new
  // column always starts descending (newest / highest first).
  // -----------------------------------------------------------
  const handleSort = (field) => {
    setPage(1);

    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const sortIndicator = (field) => {
    if (sortBy !== field) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  const clearFilters = () => {
    setNameInput("");
    setFromDateInput("");
    setToDateInput("");
    setMinAmountInput("");
    setMaxAmountInput("");
  };

  // -----------------------------------------------------------
  // More Info panel — password re-verified server-side before the
  // financial totals are released. Closing the panel clears
  // everything (including the fetched numbers) so the password is
  // required again next time, rather than caching sensitive data.
  // -----------------------------------------------------------
  const openFinancials = () => {
    setShowFinancials(true);
  };

  const closeFinancials = () => {
    setShowFinancials(false);
    setFinancialsPassword("");
    setFinancialsError("");
    setFinancials(null);
  };

  const verifyFinancials = async (e) => {
    e.preventDefault();

    if (!financialsPassword) {
      setFinancialsError("Enter your password.");
      return;
    }

    setFinancialsLoading(true);
    setFinancialsError("");

    try {
      const res = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: financialsPassword }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check the API server is running.`,
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Verification failed.");
      }

      setFinancials(data);
      setFinancialsPassword("");
    } catch (err) {
      setFinancialsError(err.message || "Something went wrong.");
    } finally {
      setFinancialsLoading(false);
    }
  };

  const hasActiveFilters =
    appliedFilters.name ||
    appliedFilters.fromDate ||
    appliedFilters.toDate ||
    appliedFilters.minAmount ||
    appliedFilters.maxAmount;

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "30px auto",
        padding: "0 20px 40px",
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
          marginBottom: "6px",
        }}
      >
        <h2
          style={{
            color: "#f97316",
            margin: 0,
            fontSize: "22px",
          }}
        >
          Manage Loans
        </h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={openFinancials}
            style={{
              padding: "10px 18px",
              borderRadius: "7px",
              border: "1px solid #3f3f46",
              background: "transparent",
              color: "#e4e4e7",
              fontSize: "13.5px",
              fontWeight: "600",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            ℹ️ More Info
          </button>

          <button
            type="button"
            onClick={() => navigate("/admin/loan/add-loan")}
            style={{
              padding: "10px 18px",
              borderRadius: "7px",
              border: "none",
              background: "#f97316",
              color: "#fff",
              fontSize: "13.5px",
              fontWeight: "600",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add Loan
          </button>
        </div>
      </div>

      <div
        style={{
          color: "#71717a",
          fontSize: "13px",
          marginBottom: "22px",
        }}
      >
        {total} loan{total === 1 ? "" : "s"} total
      </div>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto",
          gap: "12px",
          alignItems: "end",
          padding: "18px",
          background: "#111113",
          border: "1px solid #27272a",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
        className="filters-grid"
      >
        <div>
          <label style={labelStyle}>Search by Name</label>
          <input
            type="text"
            placeholder="Customer name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>From Date</label>
          <input
            type="date"
            value={fromDateInput}
            onChange={(e) => setFromDateInput(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          />
        </div>

        <div>
          <label style={labelStyle}>To Date</label>
          <input
            type="date"
            value={toDateInput}
            onChange={(e) => setToDateInput(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          />
        </div>

        <div>
          <label style={labelStyle}>Min Amount</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="₹0"
            value={minAmountInput}
            onChange={(e) =>
              setMinAmountInput(e.target.value.replace(/\D/g, ""))
            }
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Max Amount</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Any"
            value={maxAmountInput}
            onChange={(e) =>
              setMaxAmountInput(e.target.value.replace(/\D/g, ""))
            }
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          style={{
            padding: "12px 16px",
            borderRadius: "7px",
            border: "1px solid #3f3f46",
            background: "transparent",
            color: hasActiveFilters ? "#e4e4e7" : "#52525b",
            fontSize: "13px",
            fontWeight: "600",
            cursor: hasActiveFilters ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          Clear
        </button>
      </div>

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div
        style={{
          border: "1px solid #27272a",
          borderRadius: "10px",
          overflow: "hidden",
          background: "#111113",
        }}
      >
        <div
          className="loan-row loan-header-row"
          style={tableRowStyle}
        >
          <button
            type="button"
            onClick={() => handleSort("name")}
            style={sortableHeaderStyle}
          >
            NAME{sortIndicator("name")}
          </button>

          <button
            type="button"
            onClick={() => handleSort("date")}
            style={sortableHeaderStyle}
          >
            DATE OF LOAN{sortIndicator("date")}
          </button>

          <button
            type="button"
            onClick={() => handleSort("loanAmount")}
            style={{ ...sortableHeaderStyle, textAlign: "right" }}
          >
            AMOUNT{sortIndicator("loanAmount")}
          </button>
        </div>

        {loading && (
          <div style={emptyStateStyle}>Loading loans...</div>
        )}

        {!loading && error && (
          <div style={{ ...emptyStateStyle, color: "#ef4444" }}>{error}</div>
        )}

        {!loading && !error && loans.length === 0 && (
          <div style={emptyStateStyle}>
            {hasActiveFilters
              ? "No loans match your filters."
              : "No loans found."}
          </div>
        )}

        {!loading &&
          !error &&
          loans.map((loan) => (
            <div
              key={loan._id}
              className="loan-row"
              style={{
                ...tableRowStyle,
                cursor: "pointer",
                borderTop: "1px solid #1f1f23",
              }}
              onClick={() => navigate(`/admin/loan/edit-loan/${loan._id}`)}
            >
              <div style={{ color: "#fff", fontSize: "14px" }}>
                {loan.name}
              </div>

              <div style={{ color: "#a1a1aa", fontSize: "13px" }}>
                {formatDisplayDate(loan.date)}
              </div>

              <div
                style={{
                  color: "#22c55e",
                  fontSize: "14px",
                  fontWeight: "600",
                  textAlign: "right",
                }}
              >
                ₹{Number(loan.loanAmount || 0).toFixed(2)}
              </div>
            </div>
          ))}
      </div>

      {/* =====================================================
          PAGINATION
      ====================================================== */}

      {!loading && !error && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={pageButtonStyle(page <= 1)}
          >
            Prev
          </button>

          <span style={{ color: "#a1a1aa", fontSize: "13px" }}>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={pageButtonStyle(page >= totalPages)}
          >
            Next
          </button>
        </div>
      )}

      {/* =====================================================
          MORE INFO — password-gated financial totals
      ====================================================== */}

      {showFinancials && (
        <FinancialsInfoModal
          financials={financials}
          password={financialsPassword}
          onPasswordChange={setFinancialsPassword}
          onSubmit={verifyFinancials}
          loading={financialsLoading}
          error={financialsError}
          onClose={closeFinancials}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .filters-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 700px) {
          .loan-row {
            grid-template-columns: 1fr 1fr !important;
          }

          .loan-row > *:nth-child(3) {
            display: none;
          }
        }

        input:focus {
          border-color: #f97316 !important;
        }
      `}</style>
    </div>
  );
};

const FinancialsInfoModal = ({
  financials,
  password,
  onPasswordChange,
  onSubmit,
  loading,
  error,
  onClose,
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
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: "400px",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "26px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div
          style={{
            color: "#f97316",
            fontSize: "17px",
            fontWeight: "700",
          }}
        >
          Financial Totals
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            color: "#71717a",
            fontSize: "18px",
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px",
          }}
        >
          ✕
        </button>
      </div>

      {!financials ? (
        <>
          <div
            style={{
              color: "#71717a",
              fontSize: "12.5px",
              marginBottom: "18px",
            }}
          >
            Enter your admin password to view loan amount, interest, and
            outstanding totals.
          </div>

          <form onSubmit={onSubmit}>
            <input
              type="password"
              placeholder="Admin password"
              autoFocus
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#09090b",
                border: "1px solid #27272a",
                borderRadius: "7px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "10px",
              }}
            />

            {error && (
              <div
                style={{
                  color: "#ef4444",
                  fontSize: "12.5px",
                  marginBottom: "10px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
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
              {loading ? "Verifying..." : "Verify & View"}
            </button>
          </form>
        </>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "14px",
          }}
        >
          <FinancialsRow
            label="Total Loan Amount"
            value={financials.totalLoanAmount}
          />
          <FinancialsRow
            label="Total Interest"
            value={financials.totalInterest}
            color="#f59e0b"
          />
          <FinancialsRow
            label="Total Outstanding"
            value={financials.totalOutstanding}
            color="#ef4444"
          />
        </div>
      )}
    </div>
  </div>
);

const FinancialsRow = ({ label, value, color = "#22c55e" }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "8px",
    }}
  >
    <span style={{ color: "#a1a1aa", fontSize: "13px" }}>{label}</span>
    <span style={{ color, fontSize: "16px", fontWeight: "700" }}>
      ₹{Number(value || 0).toFixed(2)}
    </span>
  </div>
);

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#a1a1aa",
  fontSize: "12px",
  fontWeight: "500",
};

const inputStyle = {
  width: "100%",
  padding: "11px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "13.5px",
  outline: "none",
  boxSizing: "border-box",
};

const tableRowStyle = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr",
  gap: "12px",
  padding: "14px 18px",
  alignItems: "center",
};

const sortableHeaderStyle = {
  background: "transparent",
  border: "none",
  color: "#71717a",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.03em",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};

const emptyStateStyle = {
  padding: "40px 18px",
  textAlign: "center",
  color: "#52525b",
  fontSize: "13px",
};

const pageButtonStyle = (disabled) => ({
  padding: "9px 16px",
  borderRadius: "7px",
  border: "1px solid #3f3f46",
  background: disabled ? "#18181b" : "transparent",
  color: disabled ? "#3f3f46" : "#e4e4e7",
  fontSize: "13px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
});

export default AdminLoanProduct;