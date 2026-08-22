import React, { useState, useContext, useCallback, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import RecordPaymentModal from "./RecordPaymentModal";

const ManageVyapars = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // =========================================================
  // FILTERS / SORT / PAGINATION
  // =========================================================

  const [filterInputs, setFilterInputs] = useState({
    name: "",
    customerId: "",
    phone: "",
    metal: "",
  });

  // Only updated on Search submit, so typing doesn't refetch on every
  // keystroke — the fetch effect depends on this, not on filterInputs.
  const [appliedFilters, setAppliedFilters] = useState({
    name: "",
    customerId: "",
    phone: "",
    metal: "",
  });

  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // =========================================================
  // DATA
  // =========================================================

  const [vyapars, setVyapars] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null); // { vyaparId, item }

  // =========================================================
  // FETCH
  // =========================================================

  const fetchVyapars = useCallback(async () => {
    if (!user?.token) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });

      if (appliedFilters.name) params.set("name", appliedFilters.name);
      if (appliedFilters.customerId)
        params.set("customerId", appliedFilters.customerId);
      if (appliedFilters.phone) params.set("phone", appliedFilters.phone);
      if (appliedFilters.metal) params.set("metal", appliedFilters.metal);

      const res = await fetch(`/api/vyapars?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load records.");
      }

      setVyapars(data.vyapars || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Error loading Vyapars:", err);
      setError(err.message || "Something went wrong while loading records.");
    } finally {
      setLoading(false);
    }
  }, [user?.token, page, limit, sortBy, sortOrder, appliedFilters]);

  useEffect(() => {
    fetchVyapars();
  }, [fetchVyapars]);

  // =========================================================
  // HANDLERS
  // =========================================================

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filterInputs);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record? This cannot be undone from here.")) {
      return;
    }

    try {
      const res = await fetch(`/api/vyapars/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete record.");
      }

      fetchVyapars();
    } catch (err) {
      console.error("Error deleting Vyapar:", err);
      alert(err.message || "Something went wrong while deleting.");
    }
  };

  const handlePaymentSuccess = () => {
    // Simplest correct approach: refetch, since the payment changes
    // remainingWeight totals both on the item and the row-level
    // gold/silver virtuals.
    fetchVyapars();
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "22px",
        }}
      >
        <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>
          Manage Vyapars
        </h2>

        <div style={{ color: "#71717a", fontSize: "13px" }}>
          {total} record{total === 1 ? "" : "s"}
        </div>
      </div>

      {/* =====================================================
          FILTERS
      ====================================================== */}
      <form
        onSubmit={handleSearchSubmit}
        className="filters-grid"
        style={filtersGridStyle}
      >
        <input
          type="text"
          placeholder="Search by name"
          value={filterInputs.name}
          onChange={(e) =>
            setFilterInputs((prev) => ({ ...prev, name: e.target.value }))
          }
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Customer ID"
          value={filterInputs.customerId}
          onChange={(e) =>
            setFilterInputs((prev) => ({
              ...prev,
              customerId: e.target.value.toUpperCase(),
            }))
          }
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Phone"
          value={filterInputs.phone}
          onChange={(e) =>
            setFilterInputs((prev) => ({ ...prev, phone: e.target.value }))
          }
          style={inputStyle}
        />

        <select
          value={filterInputs.metal}
          onChange={(e) =>
            setFilterInputs((prev) => ({ ...prev, metal: e.target.value }))
          }
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">All Metals</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="createdAt">Sort: Created</option>
          <option value="name">Sort: Name</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>

        <button type="submit" style={searchButtonStyle}>
          Search
        </button>
      </form>

      {/* =====================================================
          TABLE
      ====================================================== */}
      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.08)",
            color: "#fca5a5",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Customer ID</th>
              <th style={thStyle}>Mobile</th>
              <th style={thStyle}>Linked Loan</th>
              <th style={thStyle}>Items</th>
              <th style={thStyle}>Gold Net / Remaining (g)</th>
              <th style={thStyle}>Silver Net / Remaining (g)</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={emptyCellStyle}>
                  Loading...
                </td>
              </tr>
            )}

            {!loading && vyapars.length === 0 && (
              <tr>
                <td colSpan={9} style={emptyCellStyle}>
                  No records found.
                </td>
              </tr>
            )}

            {!loading &&
              vyapars.map((v) => {
                const isExpanded = expandedId === v._id;

                // Fully settled only when every item's fine weight
                // has been paid off — matches the same threshold the
                // server checks before allowing a delete.
                const isFullySettled =
                  (v.totalGoldRemainingWeight ?? 0) <= 0.001 &&
                  (v.totalSilverRemainingWeight ?? 0) <= 0.001;

                return (
                  <React.Fragment key={v._id}>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : v._id)
                          }
                          title={isExpanded ? "Collapse" : "Expand items"}
                          style={expandButtonStyle}
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      </td>
                      <td style={tdStyle}>{v.name}</td>
                      <td style={tdStyle}>{v.customerId}</td>
                      <td style={tdStyle}>{v.mobileNo}</td>
                      <td style={tdStyle}>{v.loan?.loanId || "-"}</td>
                      <td style={tdStyle}>{v.items?.length ?? 0}</td>
                      <td style={tdStyle}>
                        {(v.totalGoldNetWeight ?? 0).toFixed(3)} /{" "}
                        <span style={{ color: "#facc15" }}>
                          {(v.totalGoldRemainingWeight ?? 0).toFixed(3)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {(v.totalSilverNetWeight ?? 0).toFixed(3)} /{" "}
                        <span style={{ color: "#d4d4d8" }}>
                          {(v.totalSilverRemainingWeight ?? 0).toFixed(3)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/vyapar/${v._id}/edit`)
                            }
                            style={actionButtonStyle}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={!isFullySettled}
                            onClick={() => handleDelete(v._id)}
                            title={
                              isFullySettled
                                ? "Delete this record"
                                : "Can't delete — settle every item's remaining fine weight first"
                            }
                            style={{
                              ...actionButtonStyle,
                              color: isFullySettled ? "#ef4444" : "#71717a",
                              borderColor: isFullySettled
                                ? "rgba(239,68,68,0.3)"
                                : "#27272a",
                              opacity: isFullySettled ? 1 : 0.5,
                              cursor: isFullySettled
                                ? "pointer"
                                : "not-allowed",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, border: "none" }}>
                          <div style={itemsPanelStyle}>
                            {(v.items || []).length === 0 && (
                              <div style={{ color: "#52525b", fontSize: "13px" }}>
                                No items on this record.
                              </div>
                            )}

                            {(v.items || []).map((item) => {
                              const remaining = Number(
                                item.remainingWeight ?? item.netWeight ?? 0,
                              );
                              const isSettled = remaining <= 0.001;

                              return (
                                <div key={item._id} style={itemRowStyle}>
                                  <div style={itemRowGridStyle}>
                                    <span
                                      style={{
                                        textTransform: "capitalize",
                                        color:
                                          item.metal === "gold"
                                            ? "#facc15"
                                            : "#d4d4d8",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {item.metal}
                                    </span>
                                    <span>
                                      Gross {Number(item.grossWeight).toFixed(3)}
                                      g
                                    </span>
                                    <span>Tunch {item.tunch}%</span>
                                    <span>
                                      Net {Number(item.netWeight).toFixed(3)}g
                                    </span>
                                    <span
                                      style={{
                                        color: isSettled ? "#22c55e" : "#f59e0b",
                                      }}
                                    >
                                      {isSettled
                                        ? "Settled"
                                        : `Remaining ${remaining.toFixed(3)}g`}
                                    </span>
                                    <span>Labour ₹{item.labour}</span>

                                    <button
                                      type="button"
                                      disabled={isSettled}
                                      onClick={() =>
                                        setPaymentTarget({
                                          vyaparId: v._id,
                                          item,
                                        })
                                      }
                                      style={{
                                        ...actionButtonStyle,
                                        opacity: isSettled ? 0.4 : 1,
                                        cursor: isSettled
                                          ? "not-allowed"
                                          : "pointer",
                                      }}
                                    >
                                      Record Payment
                                    </button>
                                  </div>

                                  {item.description && (
                                    <div
                                      style={{
                                        color: "#71717a",
                                        fontSize: "12.5px",
                                        marginTop: "6px",
                                      }}
                                    >
                                      {item.description}
                                    </div>
                                  )}

                                  {(item.finePayments || []).length > 0 && (
                                    <div style={finePaymentsListStyle}>
                                      {item.finePayments.map((p) => (
                                        <div
                                          key={p._id}
                                          style={finePaymentRowStyle}
                                        >
                                          <span>
                                            {new Date(
                                              p.date,
                                            ).toLocaleDateString("en-IN")}
                                          </span>
                                          <span>
                                            {Number(p.fineWeight).toFixed(3)}g
                                            <sub style={subFTagStyle}>F</sub> @
                                            ₹{p.rate}/10g
                                          </span>
                                          <span style={{ color: "#22c55e" }}>
                                            ₹{Number(p.amount).toFixed(2)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          PAGINATION
      ====================================================== */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          marginTop: "18px",
        }}
      >
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={{
            ...actionButtonStyle,
            opacity: page <= 1 ? 0.4 : 1,
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          Prev
        </button>

        <span style={{ color: "#a1a1aa", fontSize: "13px" }}>
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          style={{
            ...actionButtonStyle,
            opacity: page >= totalPages ? 0.4 : 1,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>
      </div>

      {paymentTarget && (
        <RecordPaymentModal
          vyaparId={paymentTarget.vyaparId}
          item={paymentTarget.item}
          onClose={() => setPaymentTarget(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .filters-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .filters-grid {
            grid-template-columns: 1fr !important;
          }
        }

        input:focus, select:focus {
          border-color: #f97316 !important;
        }
      `}</style>
    </div>
  );
};

// =========================================================
// STYLES
// =========================================================

const inputStyle = {
  width: "100%",
  padding: "11px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "13.5px",
  outline: "none",
  boxSizing: "border-box",
};

const filtersGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1fr auto",
  gap: "10px",
  marginBottom: "22px",
};

const searchButtonStyle = {
  border: "none",
  background: "#f97316",
  color: "#fff",
  borderRadius: "7px",
  padding: "0 18px",
  cursor: "pointer",
  fontSize: "13.5px",
  fontWeight: "600",
  whiteSpace: "nowrap",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#71717a",
  fontSize: "11.5px",
  fontWeight: "600",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  borderBottom: "1px solid #27272a",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px",
  color: "#e4e4e7",
  fontSize: "13.5px",
  whiteSpace: "nowrap",
};

const emptyCellStyle = {
  padding: "24px",
  textAlign: "center",
  color: "#52525b",
  fontSize: "13.5px",
};

const expandButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#a1a1aa",
  cursor: "pointer",
  fontSize: "14px",
  padding: "4px 6px",
};

const actionButtonStyle = {
  border: "1px solid #3f3f46",
  background: "transparent",
  color: "#e4e4e7",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: "12.5px",
  fontWeight: "600",
  whiteSpace: "nowrap",
};

const itemsPanelStyle = {
  padding: "14px 20px",
  background: "#09090b",
  borderBottom: "1px solid #27272a",
};

const itemRowStyle = {
  padding: "10px 0",
  borderBottom: "1px solid #1f1f23",
};

const itemRowGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  alignItems: "center",
  color: "#a1a1aa",
  fontSize: "13px",
};

const finePaymentsListStyle = {
  marginTop: "8px",
  paddingTop: "8px",
  borderTop: "1px dashed #27272a",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const finePaymentRowStyle = {
  display: "flex",
  gap: "16px",
  color: "#71717a",
  fontSize: "12px",
};

const subFTagStyle = {
  color: "#facc15",
  fontWeight: "700",
  fontSize: "9px",
};

export default ManageVyapars;