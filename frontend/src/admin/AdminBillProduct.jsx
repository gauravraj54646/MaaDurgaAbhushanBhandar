import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const statusColors = {
  paid: "#22c55e",
  partial: "#f59e0b",
  pending: "#ef4444",
};

const AdminBillProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

const billNumbersFromUrl = useMemo(() => {
  const params = new URLSearchParams(location.search);

  return (params.get("billNos") || "")
    .split(",")
    .map((num) => num.trim().toUpperCase())
    .filter(Boolean);
}, [location.search]);

const isMultipleBillView = billNumbersFromUrl.length > 0;

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [nameSearch, setNameSearch] = useState("");
  const [billNoSearch, setBillNoSearch] = useState("");
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
    // MULTIPLE BILL VIEW:
    // Fetch every page so the customer sees all their bills.
    if (isMultipleBillView) {
      const allBills = [];
      let currentPage = 1;
      let pages = 1;

      do {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: "100",
          sortBy,
          sortOrder,
          billNos: billNumbersFromUrl.join(","),
        });

        const res = await fetch(`/api/bills?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to load bills");
        }

        allBills.push(...(data.bills || []));
        pages = data.totalPages || 1;
        currentPage++;
      } while (currentPage <= pages);

      setBills(allBills);
      setTotalPages(1);
      setPage(1);
      return;
    }

    // NORMAL BILL LIST VIEW — existing filters and pagination
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      sortBy,
      sortOrder,
    });

    if (nameSearch.trim()) {
      params.set("customerName", nameSearch.trim());
    }

    if (billNoSearch.trim()) {
      params.set("billNo", billNoSearch.trim());
    }

    if (paymentStatus) {
      params.set("paymentStatus", paymentStatus);
    }

    const res = await fetch(`/api/bills?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to load bills");
    }

    setBills(data.bills || []);
    setTotalPages(data.totalPages || 1);

  } catch (err) {
    setError(err.message || "Failed to load bills");
  } finally {
    setLoading(false);
  }
}, [
  user,
  page,
  sortBy,
  sortOrder,
  nameSearch,
  billNoSearch,
  paymentStatus,
  isMultipleBillView,
  billNumbersFromUrl,
]);

const totalGrandAmount = useMemo(
  () =>
    bills.reduce(
      (total, bill) => total + Number(bill.grandTotal || 0),
      0
    ),
  [bills]
);

const totalBalanceDue = useMemo(
  () =>
    bills.reduce(
      (total, bill) => total + Number(bill.balanceDue || 0),
      0
    ),
  [bills]
);

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
  //  fetchBills();
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

{isMultipleBillView && (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "15px",
      padding: "16px",
      marginBottom: "20px",
      background: "#18181b",
      border: "1px solid #3f3f46",
      borderRadius: "10px",
    }}
  >
    <div>
      <div style={{ color: "#a1a1aa", fontSize: "12px" }}>
        Customer Bills
      </div>

      <div style={{ color: "#e4e4e7", fontSize: "13px", marginTop: "5px" }}>
        {billNumbersFromUrl.join(", ")}
      </div>
    </div>

    <div style={{ display: "flex", gap: "25px", flexWrap: "wrap" }}>
      <div>
        <div style={{ color: "#a1a1aa", fontSize: "12px" }}>
          Total Bills
        </div>
        <div style={{ color: "#fff", fontSize: "20px", fontWeight: "700" }}>
          {bills.length}
        </div>
      </div>

      <div>
        <div style={{ color: "#a1a1aa", fontSize: "12px" }}>
          Combined Grand Total
        </div>
        <div style={{ color: "#22c55e", fontSize: "20px", fontWeight: "700" }}>
          ₹{totalGrandAmount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>

      <div>
        <div style={{ color: "#a1a1aa", fontSize: "12px" }}>
          Total Balance Due
        </div>
        <div style={{ color: "#f59e0b", fontSize: "20px", fontWeight: "700" }}>
          ₹{totalBalanceDue.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={() =>
  navigate("/admin/bill/products", { replace: true })}
      style={secondaryButtonStyle}
    >
      Show All Bills
    </button>
  </div>
)}
      {/* =====================================================
          FILTERS
      ====================================================== */}
     {!isMultipleBillView && (
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
          placeholder="Search by customer name"
          value={nameSearch}
          onChange={(e) => {
            setNameSearch(e.target.value);
            setPage(1);
          }}
          style={{ ...inputStyle, flex: "2 1 220px" }}
        />

        <input
          type="text"
          placeholder="Search by bill no."
          value={billNoSearch}
          onChange={(e) => {
            setBillNoSearch(
              e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15),
            );
            setPage(1);
          }}
          style={{ ...inputStyle, flex: "1 1 160px" }}
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
)}
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
                  <Td>
                    <CopyableText text={bill.billNo || ""} label="Bill No.">
                      <span>{bill.billNo}</span>
                    </CopyableText>
                  </Td>

                  <Td>
                    <CopyableText text={formatDate(bill.billDate)} label="date">
                      <span>{formatDate(bill.billDate)}</span>
                    </CopyableText>
                  </Td>

                  <Td>
                    <CopyableText text={bill.customerName || ""} label="customer name">
                      <span>{bill.customerName}</span>
                    </CopyableText>
                  </Td>

                  <Td>
                    <CopyableText text={bill.mobileNo || ""} label="mobile number">
                      <span>{bill.mobileNo}</span>
                    </CopyableText>
                  </Td>
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
      {!isMultipleBillView && totalPages > 1 && (
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
            <style>{`
        .copy-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .copy-btn {
          opacity: 0;
          width: 22px;
          height: 22px;
          padding: 0;
          border: 1px solid #3f3f46;
          border-radius: 5px;
          background: #18181b;
          color: #a1a1aa;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          transition: opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .copy-wrap:hover .copy-btn,
        td:hover .copy-btn,
        .copy-btn:focus-visible,
        .copy-btn.copied {
          opacity: 1;
        }

        .copy-btn:hover {
          color: #f97316;
          border-color: #f97316;
        }

        .copy-btn.copied {
          color: #22c55e;
          border-color: #22c55e;
        }

        @media (hover: none) {
          .copy-btn {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
// =========================================================
// COPYABLE TEXT (shows a copy button on hover)
// =========================================================

const CopyableText = ({ text, label, children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event) => {
    event.stopPropagation();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <span className="copy-wrap">
      {children}

      <button
        type="button"
        className={`copy-btn ${copied ? "copied" : ""}`}
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy ${label}`}
        aria-label={`Copy ${label}`}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </span>
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