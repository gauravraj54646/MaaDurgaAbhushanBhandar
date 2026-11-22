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

// =========================================================
// useIsMobile: true when viewport is <= breakpoint
// =========================================================
const useIsMobile = (breakpoint = 768) => {
  const query = `(max-width: ${breakpoint}px)`;
  const getMatch = () =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  const [isMobile, setIsMobile] = useState(getMatch);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);

    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return isMobile;
};

const AdminBillProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile(768);

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
  const [mobileSearch, setMobileSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sortBy, setSortBy] = useState("billDate");
  const [sortOrder, setSortOrder] = useState("desc");

  // Mobile search: one box, with chips to pick what it searches
  const [searchMode, setSearchMode] = useState("name"); // "name" | "billNo" | "mobile"

  const mobileSearchValue =
    searchMode === "name"
      ? nameSearch
      : searchMode === "billNo"
      ? billNoSearch
      : mobileSearch;

  const handleMobileSearch = (value) => {
    setNameSearch("");
    setBillNoSearch("");
    setMobileSearch("");

    if (searchMode === "name") {
      setNameSearch(value);
    } else if (searchMode === "billNo") {
      setBillNoSearch(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15));
    } else {
      setMobileSearch(value.replace(/\D/g, "").slice(0, 10));
    }
    setPage(1);
  };

  const switchSearchMode = (mode) => {
    setSearchMode(mode);
    setNameSearch("");
    setBillNoSearch("");
    setMobileSearch("");
    setPage(1);
  };

  // Password-gated deletion
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, billNo }
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchBills = useCallback(async () => {
    if (!user?.token) return;

    setLoading(true);
    setError("");

    try {
      // MULTIPLE BILL VIEW: fetch every page so the customer sees all bills.
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
            headers: { Authorization: `Bearer ${user.token}` },
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

      // NORMAL BILL LIST VIEW
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy,
        sortOrder,
      });

      if (nameSearch.trim()) params.set("customerName", nameSearch.trim());
      if (billNoSearch.trim()) params.set("billNo", billNoSearch.trim());
      if (mobileSearch.trim()) params.set("mobileNo", mobileSearch.trim());
      if (paymentStatus) params.set("paymentStatus", paymentStatus);

      const res = await fetch(`/api/bills?${params.toString()}`, {
        headers: { Authorization: `Bearer ${user.token}` },
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
    mobileSearch,
    paymentStatus,
    isMultipleBillView,
    billNumbersFromUrl,
  ]);

  const totalGrandAmount = useMemo(
    () => bills.reduce((total, bill) => total + Number(bill.grandTotal || 0), 0),
    [bills]
  );

  const totalBalanceDue = useMemo(
    () => bills.reduce((total, bill) => total + Number(bill.balanceDue || 0), 0),
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
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatMoney = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: "1360px",
        margin: isMobile ? "16px auto" : "30px auto",
        padding: isMobile ? "0 12px" : "0 20px",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: isMobile ? "14px" : "22px",
        }}
      >
        <h2
          style={{
            color: "#f97316",
            margin: 0,
            fontSize: isMobile ? "19px" : "22px",
          }}
        >
          Manage Bills
        </h2>

        <button
          type="button"
          onClick={() => navigate("/admin/bill/add-bill")}
          style={primaryButtonStyle}
        >
          + New Bill
        </button>
      </div>

      {/* MULTIPLE BILL SUMMARY */}
      {isMultipleBillView && (
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: "wrap",
            gap: isMobile ? "14px" : "15px",
            padding: isMobile ? "14px" : "16px",
            marginBottom: "20px",
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "10px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#a1a1aa", fontSize: "12px" }}>Customer Bills</div>

            <div
              style={{
                color: "#e4e4e7",
                fontSize: "13px",
                marginTop: "5px",
                wordBreak: "break-word",
              }}
            >
              {billNumbersFromUrl.join(", ")}
            </div>
          </div>

          <div
            style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
              gap: isMobile ? "12px" : "25px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ color: "#a1a1aa", fontSize: "12px" }}>Total Bills</div>
              <div style={{ color: "#fff", fontSize: isMobile ? "17px" : "20px", fontWeight: "700" }}>
                {bills.length}
              </div>
            </div>

            <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
              <div style={{ color: "#a1a1aa", fontSize: "12px" }}>Combined Grand Total</div>
              <div style={{ color: "#22c55e", fontSize: isMobile ? "17px" : "20px", fontWeight: "700" }}>
                {formatMoney(totalGrandAmount)}
              </div>
            </div>

            <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
              <div style={{ color: "#a1a1aa", fontSize: "12px" }}>Total Balance Due</div>
              <div style={{ color: "#f59e0b", fontSize: isMobile ? "17px" : "20px", fontWeight: "700" }}>
                {formatMoney(totalBalanceDue)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/bill/products", { replace: true })}
            style={{ ...secondaryButtonStyle, width: isMobile ? "100%" : "auto" }}
          >
            Show All Bills
          </button>
        </div>
      )}

      {/* FILTERS: MOBILE (single search box + chips) */}
      {!isMultipleBillView && isMobile && (
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            inputMode={searchMode === "mobile" ? "numeric" : "text"}
            placeholder={
              searchMode === "name"
                ? "Search customer name"
                : searchMode === "billNo"
                ? "Search bill no."
                : "Search mobile number"
            }
            value={mobileSearchValue}
            onChange={(e) => handleMobileSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />

          {/* Search by: Name / Bill No / Mobile */}
          <div style={chipRowStyle}>
            <Chip active={searchMode === "name"} onClick={() => switchSearchMode("name")}>
              By Name
            </Chip>
            <Chip active={searchMode === "billNo"} onClick={() => switchSearchMode("billNo")}>
              By Bill No.
            </Chip>
            <Chip active={searchMode === "mobile"} onClick={() => switchSearchMode("mobile")}>
              By Mobile
            </Chip>
          </div>

          {/* Status chips */}
          <div style={chipRowStyle}>
            {[
              { value: "", label: "All" },
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partial" },
              { value: "pending", label: "Pending" },
            ].map((s) => (
              <Chip
                key={s.value || "all"}
                active={paymentStatus === s.value}
                color={statusColors[s.value]}
                onClick={() => {
                  setPaymentStatus(s.value);
                  setPage(1);
                }}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS: DESKTOP */}
      {!isMultipleBillView && !isMobile && (
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "14px",
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
                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)
              );
              setPage(1);
            }}
            style={{ ...inputStyle, flex: "1 1 160px" }}
          />

          <input
            type="text"
            inputMode="numeric"
            placeholder="Search by mobile no."
            value={mobileSearch}
            onChange={(e) => {
              setMobileSearch(e.target.value.replace(/\D/g, "").slice(0, 10));
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
            style={{ ...inputStyle, cursor: "pointer", flex: "1 1 160px" }}
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
          MOBILE: CARD LIST
      ====================================================== */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {loading && <div style={emptyCellStyle}>Loading bills...</div>}

          {!loading && bills.length === 0 && (
            <div style={emptyCellStyle}>No bills found.</div>
          )}

          {!loading &&
            bills.map((bill) => {
              const due = Number(bill.balanceDue || 0);

              return (
                <div key={bill._id} style={cardStyle}>
                  {/* Top: bill no + date, status on the right */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f97316", fontWeight: "700", fontSize: "14px" }}>
                        {bill.billNo}
                      </div>
                      <div style={{ color: "#71717a", fontSize: "11.5px", marginTop: "2px" }}>
                        {formatDate(bill.billDate)}
                      </div>
                    </div>

                    <span
                      style={{
                        color: statusColors[bill.paymentStatus] || "#a1a1aa",
                        fontWeight: "700",
                        fontSize: "11.5px",
                        textTransform: "uppercase",
                        border: `1px solid ${statusColors[bill.paymentStatus] || "#3f3f46"}`,
                        borderRadius: "999px",
                        padding: "3px 10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {bill.paymentStatus}
                    </span>
                  </div>

                  {/* Customer (mobile number shown when due, or when searching by mobile) */}
                  <div
                    style={{
                      marginTop: "10px",
                      color: "#e4e4e7",
                      fontSize: "14px",
                      fontWeight: "600",
                      wordBreak: "break-word",
                    }}
                  >
                    {bill.customerName || "-"}
                  </div>
                  {bill.mobileNo && (due > 0 || searchMode === "mobile") && (
                    <a
                      href={`tel:${bill.mobileNo}`}
                      style={{
                        color: "#a1a1aa",
                        fontSize: "12.5px",
                        textDecoration: "none",
                        display: "inline-block",
                        marginTop: "2px",
                      }}
                    >
                      📞 {bill.mobileNo}
                    </a>
                  )}

                  {/* Amounts */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #27272a",
                    }}
                  >
                    <div>
                      <div style={cardLabelStyle}>Grand Total</div>
                      <div style={{ color: "#fff", fontWeight: "700", fontSize: "15px", marginTop: "2px" }}>
                        {formatMoney(bill.grandTotal)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={cardLabelStyle}>Balance Due</div>
                      <div
                        style={{
                          color: due > 0 ? "#f59e0b" : "#22c55e",
                          fontWeight: "700",
                          fontSize: "15px",
                          marginTop: "2px",
                        }}
                      >
                        {formatMoney(due)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/bill/edit-bill/${bill._id}`)}
                      style={{
                        ...secondaryButtonStyle,
                        flex: 1,
                        color: "#f97316",
                        borderColor: "rgba(249,115,22,0.4)",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => requestDelete(bill._id, bill.billNo)}
                      style={{
                        ...secondaryButtonStyle,
                        flex: 1,
                        color: "#ef4444",
                        borderColor: "rgba(239,68,68,0.4)",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        /* =====================================================
            DESKTOP: TABLE
        ====================================================== */
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
                <Th align="right">Balance Due</Th>
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
                  <tr key={bill._id} style={{ borderTop: "1px solid #27272a" }}>
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
      )}

      {/* PAGINATION */}
      {!isMultipleBillView && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: isMobile ? "10px" : "14px",
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

          <span style={{ color: "#a1a1aa", fontSize: "13px", whiteSpace: "nowrap" }}>
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

      {/* DELETE CONFIRMATION MODAL (password-gated) */}
      {deleteTarget && (
        <div style={overlayStyle} onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...modalStyle, padding: isMobile ? "22px" : "30px" }}
          >
            <h3 style={{ color: "#ef4444", marginBottom: "10px", marginTop: 0 }}>
              Confirm Deletion
            </h3>
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
              style={{ ...inputStyle, width: "100%" }}
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
          max-width: 100%;
        }

        .copy-btn {
          opacity: 0;
          flex: 0 0 auto;
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
// COPYABLE TEXT (desktop table only)
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

const Chip = ({ active, onClick, color, children }) => {
  const c = color || "#f97316";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        padding: "7px 14px",
        borderRadius: "999px",
        border: `1px solid ${active ? c : "#3f3f46"}`,
        background: active ? "rgba(249,115,22,0.12)" : "#18181b",
        color: active ? c : "#a1a1aa",
        fontSize: "12.5px",
        fontWeight: "600",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
};

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

// =========================================================
// STYLES
// =========================================================

const emptyCellStyle = {
  padding: "30px",
  textAlign: "center",
  color: "#52525b",
  fontSize: "13.5px",
};

const cardStyle = {
  background: "#111113",
  border: "1px solid #27272a",
  borderRadius: "10px",
  padding: "14px",
  boxSizing: "border-box",
  width: "100%",
};

const cardLabelStyle = {
  color: "#a1a1aa",
  fontSize: "11.5px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const chipRowStyle = {
  display: "flex",
  gap: "8px",
  marginTop: "10px",
  overflowX: "auto",
  paddingBottom: "2px",
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
  width: "100%",
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

// font-size 16px prevents iOS Safari from zooming in when an input is focused
const inputStyle = {
  padding: "12px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "16px",
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