import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const statusColors = {
  paid: "#22c55e",
  partial: "#f59e0b",
  pending: "#ef4444",
};

const AdminBillProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sortBy, setSortBy] = useState("billDate");
  const [sortOrder, setSortOrder] = useState("desc");

  // Password-gated deletion (same pattern as EditLoanProduct's row
  // deletion) — clicking Delete opens a confirm modal that requires
  // the admin password before the DELETE request actually fires.
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, billNo }
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!user?.token) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy,
        sortOrder,
      });

      if (search.trim()) {
        // A single search box driving both billNo and customerName lets
        // staff type either without picking a field first.
        params.set("customerName", search.trim());
      }

      if (paymentStatus) {
        params.set("paymentStatus", paymentStatus);
      }

      const res = await fetch(`/api/bills?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to load bills");

      setBills(data.bills || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [user, page, sortBy, sortOrder, search, paymentStatus]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    fetchBills();
  }, [user, navigate, fetchBills]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const requestDelete = (id, billNo) => {
    setDeleteTarget({ id, billNo });
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
      // Verifies the admin's password before allowing the delete to
      // proceed — same password-check endpoint EditLoanProduct uses
      // for its row deletions.
      const verifyRes = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const verifyContentType = verifyRes.headers.get("content-type") || "";

      if (!verifyContentType.includes("application/json")) {
        throw new Error(`Server did not return JSON (status ${verifyRes.status}).`);
      }

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setDeleteError(verifyData.message || "Incorrect password. Please try again.");
        setDeleting(false);
        return;
      }

      const res = await fetch(`/api/bills/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to delete bill");

      setBills((prev) => prev.filter((b) => b._id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeletePassword("");
    } catch (err) {
      setDeleteError(err.message || "Something went wrong deleting the bill.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return "-";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: "1360px",
        margin: "30px auto",
        padding: "0 20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "22px",
        }}
      >
        <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>Manage Bills</h2>

        <button
          type="button"
          onClick={() => navigate("/admin/bill/add-bill")}
          style={primaryButtonStyle}
        >
          + New Bill
        </button>
      </div>

      {/* =====================================================
          FILTERS
      ====================================================== */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <input
          type="text"
          placeholder="Search by customer name or bill no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: "2 1 260px" }}
        />

        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          style={{ ...inputStyle, flex: "1 1 160px", cursor: "pointer" }}
        >
          <option value="">All Payment Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="pending">Pending</option>
        </select>

        <button type="submit" style={secondaryButtonStyle}>
          Search
        </button>
      </form>

      {error && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.08)",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          TABLE
      ====================================================== */}
      <div
        style={{
          border: "1px solid #27272a",
          borderRadius: "10px",
          overflow: "hidden",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
          <thead>
            <tr style={{ background: "#111113" }}>
              <Th>Bill No.</Th>
              <SortableTh label="Date" field="billDate" sortBy={sortBy} sortOrder={sortOrder} onClick={toggleSort} />
              <SortableTh label="Customer" field="customerName" sortBy={sortBy} sortOrder={sortOrder} onClick={toggleSort} />
              <Th>Mobile</Th>
              <SortableTh label="Grand Total" field="grandTotal" sortBy={sortBy} sortOrder={sortOrder} onClick={toggleSort} align="right" />
              <Th>Balance Due</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={emptyCellStyle}>
                  Loading bills...
                </td>
              </tr>
            )}

            {!loading && bills.length === 0 && (
              <tr>
                <td colSpan={8} style={emptyCellStyle}>
                  No bills found.
                </td>
              </tr>
            )}

            {!loading &&
              bills.map((bill) => (
                <tr
                  key={bill._id}
                  style={{ borderTop: "1px solid #27272a" }}
                >
                  <Td>{bill.billNo}</Td>
                  <Td>{formatDate(bill.billDate)}</Td>
                  <Td>{bill.customerName}</Td>
                  <Td>{bill.mobileNo}</Td>
                  <Td align="right">₹{Number(bill.grandTotal || 0).toFixed(2)}</Td>
                  <Td align="right">₹{Number(bill.balanceDue || 0).toFixed(2)}</Td>
                  <Td>
                    <span
                      style={{
                        color: statusColors[bill.paymentStatus] || "#a1a1aa",
                        fontWeight: "700",
                        fontSize: "12px",
                        textTransform: "uppercase",
                      }}
                    >
                      {bill.paymentStatus}
                    </span>
                  </Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/bill/edit-bill/${bill._id}`)}
                      style={linkButtonStyle}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => requestDelete(bill._id, bill.billNo)}
                      style={{
                        ...linkButtonStyle,
                        color: "#ef4444",
                        marginLeft: "12px",
                      }}
                    >
                      Delete
                    </button>
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* =====================================================
          PAGINATION
      ====================================================== */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "14px",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              ...secondaryButtonStyle,
              opacity: page <= 1 ? 0.5 : 1,
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              ...secondaryButtonStyle,
              opacity: page >= totalPages ? 0.5 : 1,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* =====================================================
          DELETE CONFIRMATION MODAL — password-gated
      ====================================================== */}
      {deleteTarget && (
        <div style={overlayStyle} onClick={() => !deleting && setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
            <h3 style={{ color: "#ef4444", marginBottom: "10px" }}>Confirm Deletion</h3>
            <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "15px" }}>
              Enter your admin password to delete bill{" "}
              <b style={{ color: "#e4e4e7" }}>{deleteTarget.billNo}</b>. This cannot be undone.
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
                  fontWeight: "600",
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
    </div>
  );
};

// =========================================================
// SMALL COMPONENTS
// =========================================================

const Th = ({ children, align = "left" }) => (
  <th
    style={{
      textAlign: align,
      padding: "12px 14px",
      color: "#a1a1aa",
      fontSize: "11.5px",
      textTransform: "uppercase",
      letterSpacing: "0.03em",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);

const SortableTh = ({ label, field, sortBy, sortOrder, onClick, align = "left" }) => {
  const active = sortBy === field;

  return (
    <th
      onClick={() => onClick(field)}
      style={{
        textAlign: align,
        padding: "12px 14px",
        color: active ? "#f97316" : "#a1a1aa",
        fontSize: "11.5px",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label} {active ? (sortOrder === "asc" ? "▲" : "▼") : ""}
    </th>
  );
};

const Td = ({ children, align = "left" }) => (
  <td
    style={{
      textAlign: align,
      padding: "12px 14px",
      color: "#e4e4e7",
      fontSize: "13.5px",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </td>
);

const FieldError = ({ msg }) =>
  msg ? <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: "5px 0 0" }}>{msg}</p> : null;

const emptyCellStyle = {
  padding: "30px",
  textAlign: "center",
  color: "#52525b",
  fontSize: "13.5px",
};

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
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
  fontWeight: "600",
  fontSize: "14px",
};

const inputStyle = {
  padding: "12px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "13.5px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: "7px",
  border: "none",
  background: "#f97316",
  color: "#fff",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const secondaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: "7px",
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#fff",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const linkButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#f97316",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  padding: 0,
};

export default AdminBillProduct;