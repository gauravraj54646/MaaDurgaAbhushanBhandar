import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const PAGE_SIZE = 12;

// Change this if your admin loan dashboard lives at a different route.
const ADMIN_LOAN_DASHBOARD_PATH = "/admin/loan";

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

// True if the loan's due date has already passed (compares whole
// days only, so a due date of "today" is not yet overdue).
const isOverdue = (dueDate) => {
  if (!dueDate) return false;

  const due = new Date(dueDate);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return due.getTime() < today.getTime();
};

// True if the loan's dissolve date has already passed — flagged
// separately from "overdue" since it means the pledged item is past
// the point it should have been auctioned/forfeited, a distinct and
// more serious situation.
const isPastDissolve = (dissolveDate) => {
  if (!dissolveDate) return false;

  const dissolve = new Date(dissolveDate);
  const today = new Date();

  dissolve.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dissolve.getTime() < today.getTime();
};

// =========================================================
// useIsMobile: true when viewport is <= breakpoint
// =========================================================
const useIsMobile = (breakpoint = 820) => {
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

// -----------------------------------------------------------
// Sidebar button — full-width, left-aligned row with an icon and
// label. `primary` gives it the orange fill used for the main
// action (Add Loan). Desktop only.
// -----------------------------------------------------------
const SidebarButton = ({ icon, label, onClick, primary = false, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title || label}
    className={`side-btn ${primary ? "side-btn-primary" : ""}`}
  >
    <span className="side-btn-icon" aria-hidden="true">
      {icon}
    </span>
    <span className="side-btn-label">{label}</span>
  </button>
);

const AdminLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile(820);

  const customerIdFromUrl =
    new URLSearchParams(location.search).get("customerId") || "";

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "More Info" panel — password-gated financial totals (desktop)
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
  const getToday = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [toDateInput, setToDateInput] = useState(getToday());
  const [nameInput, setNameInput] = useState("");
  const [customerIdInput, setCustomerIdInput] = useState(
    customerIdFromUrl.toUpperCase(),
  );
  const [loanIdInput, setLoanIdInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    name: "",
    customerId: customerIdFromUrl.toUpperCase(),
    loanId: "",
    phone: "",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
  });

  // Default: newest loan first ("now to before date")
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Mobile search: one box, with chips to pick what it searches
  const [searchMode, setSearchMode] = useState(
    customerIdFromUrl ? "customerId" : "name",
  ); // "name" | "customerId" | "loanId" | "phone"
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const mobileSearchValue =
    searchMode === "name"
      ? nameInput
      : searchMode === "customerId"
      ? customerIdInput
      : searchMode === "loanId"
      ? loanIdInput
      : phoneInput;

  const handleMobileSearch = (value) => {
    setNameInput("");
    setCustomerIdInput("");
    setLoanIdInput("");
    setPhoneInput("");

    if (searchMode === "name") {
      setNameInput(value);
    } else if (searchMode === "customerId") {
      setCustomerIdInput(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8));
    } else if (searchMode === "loanId") {
      setLoanIdInput(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8));
    } else {
      setPhoneInput(value.replace(/\D/g, "").slice(0, 10));
    }
  };

  const switchSearchMode = (mode) => {
    setSearchMode(mode);
    setNameInput("");
    setCustomerIdInput("");
    setLoanIdInput("");
    setPhoneInput("");
  };

  useEffect(() => {
    const customerId =
      new URLSearchParams(location.search).get("customerId") || "";

    const formattedId = customerId.trim().toUpperCase();

    setCustomerIdInput(formattedId);
    if (formattedId) setSearchMode("customerId");
    setPage(1);

    setAppliedFilters((prev) => ({
      ...prev,
      customerId: formattedId,
    }));
  }, [location.search]);

  // -----------------------------------------------------------
  // Debounce text/number filter inputs -> appliedFilters
  // -----------------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setAppliedFilters({
        name: nameInput.trim(),
        customerId: customerIdInput.trim().toUpperCase(),
        loanId: loanIdInput.trim().toUpperCase(),
        phone: phoneInput.trim(),
        fromDate: fromDateInput,
        toDate: toDateInput,
        minAmount: minAmountInput,
        maxAmount: maxAmountInput,
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    nameInput,
    customerIdInput,
    loanIdInput,
    phoneInput,
    fromDateInput,
    toDateInput,
    minAmountInput,
    maxAmountInput,
  ]);

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

      if (appliedFilters.name) {
        params.set("name", appliedFilters.name);
      }

      if (appliedFilters.customerId) {
        params.set("customerId", appliedFilters.customerId);
      }

      if (appliedFilters.loanId) {
        params.set("loanId", appliedFilters.loanId);
      }

      if (appliedFilters.phone) {
        params.set("phone", appliedFilters.phone);
      }

      if (appliedFilters.fromDate) {
        params.set("fromDate", appliedFilters.fromDate);
      }

      if (appliedFilters.toDate) {
        params.set("toDate", appliedFilters.toDate);
      }

      if (appliedFilters.minAmount) {
        params.set("minAmount", appliedFilters.minAmount);
      }

      if (appliedFilters.maxAmount) {
        params.set("maxAmount", appliedFilters.maxAmount);
      }

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
    setCustomerIdInput("");
    setLoanIdInput("");
    setPhoneInput("");
    setFromDateInput("");
    setToDateInput("");
    setMinAmountInput("");
    setMaxAmountInput("");
    navigate(location.pathname, { replace: true });
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
    appliedFilters.customerId ||
    appliedFilters.loanId ||
    appliedFilters.phone ||
    appliedFilters.fromDate ||
    appliedFilters.toDate ||
    appliedFilters.minAmount ||
    appliedFilters.maxAmount;

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // =====================================================
  // PAGINATION (shared by mobile + desktop)
  // =====================================================
  const pagination =
    !loading && !error && totalPages > 1 ? (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: isMobile ? "10px" : "12px",
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

        <span style={{ color: "#a1a1aa", fontSize: "13px", whiteSpace: "nowrap" }}>
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
    ) : null;

  // =====================================================
  // MOBILE VIEW — no sidebar, starts at the search block
  // =====================================================
  if (isMobile) {
    return (
      <div
        style={{
          maxWidth: "1360px",
          margin: "16px auto",
          padding: "0 12px",
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
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div>
            <h2 style={{ color: "#f97316", margin: 0, fontSize: "19px" }}>
              Manage Loans
            </h2>
            <div style={{ color: "#71717a", fontSize: "12px", marginTop: "3px" }}>
              {total} loan{total === 1 ? "" : "s"} total
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/loan/add-loan")}
            style={primaryButtonStyle}
          >
            + Add Loan
          </button>
        </div>

        {/* SEARCH: single box + chips */}
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            inputMode={searchMode === "phone" ? "numeric" : "text"}
            placeholder={
              searchMode === "name"
                ? "Search customer name"
                : searchMode === "customerId"
                ? "Search customer ID"
                : searchMode === "loanId"
                ? "Search loan ID"
                : "Search phone number"
            }
            value={mobileSearchValue}
            onChange={(e) => handleMobileSearch(e.target.value)}
            style={{ ...inputStyle, fontSize: "16px", width: "100%" }}
          />

          {/* Search by */}
          <div style={chipRowStyle}>
            <Chip active={searchMode === "name"} onClick={() => switchSearchMode("name")}>
              By Name
            </Chip>
            <Chip active={searchMode === "phone"} onClick={() => switchSearchMode("phone")}>
              By Phone
            </Chip>
            <Chip active={searchMode === "customerId"} onClick={() => switchSearchMode("customerId")}>
              By Customer ID
            </Chip>
            <Chip active={searchMode === "loanId"} onClick={() => switchSearchMode("loanId")}>
              By Loan ID
            </Chip>
          </div>

          {/* Sort + more filters */}
          <div style={chipRowStyle}>
            <Chip active={sortBy === "date"} onClick={() => handleSort("date")}>
              Date{sortIndicator("date")}
            </Chip>
            <Chip active={sortBy === "loanAmount"} onClick={() => handleSort("loanAmount")}>
              Amount{sortIndicator("loanAmount")}
            </Chip>
            <Chip active={sortBy === "name"} onClick={() => handleSort("name")}>
              Name{sortIndicator("name")}
            </Chip>
            <Chip active={showMoreFilters} onClick={() => setShowMoreFilters((s) => !s)}>
              Dates &amp; amount
            </Chip>
            {hasActiveFilters && (
              <Chip active={false} onClick={clearFilters}>
                ↻ Clear
              </Chip>
            )}
          </div>

          {showMoreFilters && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <div>
                <label style={mobileLabelStyle}>From Date</label>
                <input
                  type="date"
                  value={fromDateInput}
                  onChange={(e) => setFromDateInput(e.target.value)}
                  style={{ ...inputStyle, fontSize: "16px", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={mobileLabelStyle}>To Date</label>
                <input
                  type="date"
                  value={toDateInput}
                  onChange={(e) => setToDateInput(e.target.value)}
                  style={{ ...inputStyle, fontSize: "16px", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={mobileLabelStyle}>Min Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="₹ Minimum"
                  value={minAmountInput}
                  onChange={(e) => setMinAmountInput(e.target.value)}
                  style={{ ...inputStyle, fontSize: "16px" }}
                />
              </div>

              <div>
                <label style={mobileLabelStyle}>Max Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="₹ Maximum"
                  value={maxAmountInput}
                  onChange={(e) => setMaxAmountInput(e.target.value)}
                  style={{ ...inputStyle, fontSize: "16px" }}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              marginBottom: "14px",
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

        {/* CARD LIST */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {loading && <div style={emptyStateStyle}>Loading loans...</div>}

          {!loading && !error && loans.length === 0 && (
            <div style={emptyStateStyle}>
              {hasActiveFilters ? "No loans match your filters." : "No loans found."}
            </div>
          )}

          {!loading &&
            !error &&
            loans.map((loan) => {
              const overdue = isOverdue(loan.dueDate);
              const pastDissolve = isPastDissolve(loan.dissolveDate);

              return (
                <div
                  key={loan._id}
                  onClick={() => navigate(`/admin/loan/edit-loan/${loan._id}`)}
                  style={{
                    ...cardStyle,
                    cursor: "pointer",
                    borderLeft: overdue ? "4px solid #ef4444" : "4px solid #f97316",
                    background: overdue ? "#3a2126" : "#2a2a33",
                    borderColor: overdue ? "rgba(239,68,68,0.7)" : "#52525b",
                  }}
                >
                  {/* Top: name (+ flags) and amount */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: "#fff",
                          fontSize: "14.5px",
                          fontWeight: "600",
                          wordBreak: "break-word",
                        }}
                      >
                        {loan.name}
                        {pastDissolve && (
                          <span
                            title="Dissolve date has passed"
                            style={{
                              marginLeft: "7px",
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#a855f7",
                              border: "1px solid #a855f7",
                              borderRadius: "4px",
                              padding: "1px 6px",
                            }}
                          >
                            T
                          </span>
                        )}
                      </div>

                      <div style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "4px" }}>
                        ID: <b style={{ color: "#f4f4f5" }}>{loan.customerId || "-"}</b>
                        {"  |  "}
                        Loan: <b style={{ color: "#f4f4f5" }}>{loan.loanId || "-"}</b>
                      </div>

                      {loan.mobileNo && (
                        <a
                          href={`tel:${loan.mobileNo}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: "#e4e4e7",
                            fontSize: "13px",
                            textDecoration: "none",
                            display: "inline-block",
                            marginTop: "4px",
                          }}
                        >
                          📞 {loan.mobileNo}
                        </a>
                      )}
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: "#4ade80", fontWeight: "700", fontSize: "16.5px" }}>
                        ₹{Number(loan.loanAmount || 0).toFixed(2)}
                      </div>

                      {overdue && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: "6px",
                            fontSize: "10.5px",
                            fontWeight: "700",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #52525b",
                    }}
                  >
                    <div>
                      <div style={cardLabelStyle}>Loan Date</div>
                      <div style={{ color: "#fff", fontSize: "12.5px", marginTop: "3px" }}>
                        {formatDisplayDate(loan.date)}
                      </div>
                    </div>

                    <div>
                      <div style={cardLabelStyle}>Due</div>
                      <div
                        style={{
                          color: overdue ? "#f87171" : "#fff",
                          fontSize: "12.5px",
                          fontWeight: overdue ? "600" : "400",
                          marginTop: "2px",
                        }}
                      >
                        {formatDisplayDate(loan.dueDate)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={cardLabelStyle}>Dissolve</div>
                      <div
                        style={{
                          color: pastDissolve ? "#c084fc" : "#fff",
                          fontSize: "12.5px",
                          fontWeight: pastDissolve ? "600" : "400",
                          marginTop: "2px",
                        }}
                      >
                        {formatDisplayDate(loan.dissolveDate)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {pagination}
      </div>
    );
  }

  // =====================================================
  // DESKTOP VIEW
  // =====================================================
  return (
    <div className="loan-page" style={pageStyle}>
      {/* =====================================================
          LEFT SIDEBAR — all page actions live here
      ====================================================== */}

      <aside className="loan-sidebar" style={sidebarStyle}>
        <SidebarButton
          icon="←"
          label="Loan dashboard"
          title="Back to Admin Loan Dashboard"
          onClick={() => navigate(ADMIN_LOAN_DASHBOARD_PATH)}
        />

        <div className="side-divider" />

        <SidebarButton
          icon="⌕"
          label="Search loans"
          onClick={() =>
            document
              .getElementById("loan-search-section")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />

        <SidebarButton
          icon="+"
          label="Add loan"
          primary
          onClick={() => navigate("/admin/loan/add-loan")}
        />

        <SidebarButton
          icon="👤"
          label="Add people"
          onClick={() => navigate("/admin/people")}
        />

        <div className="side-divider" />

        <SidebarButton
          icon="📊"
          label="Analytics info"
          onClick={() => navigate("/admin/loan/analytics")}
        />

        <SidebarButton
          icon="🔒"
          label="More info"
          title="Password-protected financial totals"
          onClick={openFinancials}
        />
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <main style={mainStyle}>
        <div style={{ marginBottom: "22px" }}>
          <h2
            style={{
              color: "#f97316",
              margin: 0,
              fontSize: "22px",
            }}
          >
            Manage Loans
          </h2>

          <div
            style={{
              color: "#71717a",
              fontSize: "13px",
              marginTop: "4px",
            }}
          >
            {total} loan{total === 1 ? "" : "s"} total
          </div>
        </div>

        {/* =====================================================
            FILTERS
        ====================================================== */}

        <div
          id="loan-search-section"
          className="search-card"
          style={{
            scrollMarginTop: "20px",
            background: "#0f0f11",
            border: "1px solid #27272a",
            borderRadius: "12px",
            padding: "18px",
            marginBottom: "14px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <div>
              <div
                style={{
                  color: "#e4e4e7",
                  fontSize: "13px",
                  fontWeight: "700",
                  letterSpacing: "0.02em",
                }}
              >
                SEARCH LOANS
              </div>

              <div
                style={{
                  color: "#52525b",
                  fontSize: "10px",
                  marginTop: "3px",
                }}
              >
                Find loans by customer, ID, phone, date or amount
              </div>
            </div>
          </div>

          {/* Customer Search */}
          <div
            className="filters-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
              gap: "12px",
            }}
          >
            {/* Customer Name */}
            <div>
              <label style={labelStyle}>Customer Name</label>

              <input
                type="text"
                placeholder="🔍  Search customer name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Customer ID */}
            <div>
              <label style={labelStyle}>Customer ID</label>

              <input
                type="text"
                placeholder="e.g. ABC123"
                value={customerIdInput}
                maxLength={8}
                onChange={(e) =>
                  setCustomerIdInput(
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                  )
                }
                style={inputStyle}
              />
            </div>

            {/* Loan ID */}
            <div>
              <label style={labelStyle}>Loan ID</label>

              <input
                type="text"
                placeholder="e.g. LN1024"
                value={loanIdInput}
                maxLength={8}
                onChange={(e) =>
                  setLoanIdInput(
                    e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                  )
                }
                style={inputStyle}
              />
            </div>

            {/* Phone Number */}
            <div>
              <label style={labelStyle}>Phone Number</label>

              <input
                type="tel"
                inputMode="numeric"
                placeholder="e.g. 9876543210"
                value={phoneInput}
                maxLength={10}
                onChange={(e) =>
                  setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Date + Amount */}
          <div
            className="filters-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr)) 52px",
              gap: "12px",
              marginTop: "14px",
              alignItems: "end",
              justifyContent: "start",
              width: "100%",
              marginLeft: 0,
            }}
          >
            {/* From Date */}
            <div>
              <label style={labelStyle}>From Date</label>

              <input
                type="date"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              />
            </div>

            {/* To Date */}
            <div>
              <label style={labelStyle}>To Date</label>

              <input
                type="date"
                value={toDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Min Amount */}
            <div>
              <label style={labelStyle}>Min Amount</label>

              <input
                type="number"
                inputMode="decimal"
                placeholder="₹ Minimum"
                value={minAmountInput}
                onChange={(e) => setMinAmountInput(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Max Amount */}
            <div>
              <label style={labelStyle}>Max Amount</label>

              <input
                type="number"
                inputMode="decimal"
                placeholder="₹ Maximum"
                value={maxAmountInput}
                onChange={(e) => setMaxAmountInput(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Clear */}
            <button
              type="button"
              className="filters-clear-btn"
              onClick={clearFilters}
              title="Clear all filters"
              style={{
                width: "52px",
                height: "44px",
                border: "1px solid #3f3f46",
                borderRadius: "7px",
                background: "#18181b",
                color: "#a1a1aa",
                cursor: "pointer",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#f97316";
                e.currentTarget.style.color = "#f97316";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#3f3f46";
                e.currentTarget.style.color = "#a1a1aa";
              }}
            >
              ↻
            </button>
          </div>
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
          <div className="loan-table-scroll">
            <div className="loan-row loan-header-row" style={tableRowStyle}>
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

            {loading && <div style={emptyStateStyle}>Loading loans...</div>}

            {!loading && error && (
              <div style={{ ...emptyStateStyle, color: "#ef4444" }}>
                {error}
              </div>
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
              loans.map((loan) => {
                const overdue = isOverdue(loan.dueDate);
                const pastDissolve = isPastDissolve(loan.dissolveDate);

                return (
                  <div
                    key={loan._id}
                    className="loan-row"
                    style={{
                      ...tableRowStyle,
                      cursor: "pointer",
                      borderTop: "1px solid #1f1f23",
                      background: overdue
                        ? "rgba(239, 68, 68, 0.08)"
                        : "transparent",
                      borderLeft: overdue
                        ? "3px solid #ef4444"
                        : "3px solid transparent",
                    }}
                    onClick={() =>
                      navigate(`/admin/loan/edit-loan/${loan._id}`)
                    }
                  >
                    <div style={{ color: "#fff", fontSize: "14px" }}>
                      {loan.name}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          marginTop: "5px",
                          fontSize: "10.5px",
                        }}
                      >
                        <span style={{ color: "#71717a" }}>
                          Customer ID:
                          <b style={{ color: "#a1a1aa", marginLeft: "4px" }}>
                            {loan.customerId || "-"}
                          </b>
                        </span>

                        <span
                          className="meta-sep"
                          style={{
                            width: "1px",
                            height: "12px",
                            background: "#3f3f46",
                          }}
                        />

                        <span style={{ color: "#71717a" }}>
                          Loan ID:
                          <b style={{ color: "#a1a1aa", marginLeft: "4px" }}>
                            {loan.loanId || "-"}
                          </b>
                        </span>

                        {loan.mobileNo && (
                          <>
                            <span
                              className="meta-sep"
                              style={{
                                width: "1px",
                                height: "12px",
                                background: "#3f3f46",
                              }}
                            />

                            <span style={{ color: "#71717a" }}>
                              Phone:
                              <b
                                style={{ color: "#a1a1aa", marginLeft: "4px" }}
                              >
                                {loan.mobileNo}
                              </b>
                            </span>
                          </>
                        )}
                      </div>

                      {pastDissolve && (
                        <span
                          title="Dissolve date has passed"
                          style={{
                            marginLeft: "7px",
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#a855f7",
                            border: "1px solid #a855f7",
                            borderRadius: "4px",
                            padding: "1px 6px",
                            cursor: "help",
                          }}
                        >
                          T
                        </span>
                      )}
                    </div>

                    <div
                      className="date-hover-wrap"
                      style={{
                        position: "relative",
                        color: overdue ? "#ef4444" : "#a1a1aa",
                        fontSize: "13px",
                        fontWeight: overdue ? "600" : "400",
                        width: "fit-content",
                      }}
                    >
                      {formatDisplayDate(loan.date)}
                      {overdue && (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "10.5px",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                            borderRadius: "4px",
                            padding: "1px 6px",
                            verticalAlign: "middle",
                          }}
                        >
                          OVERDUE
                        </span>
                      )}

                      <div className="date-hover-tooltip">
                        <div className="date-hover-row">
                          <span>Due Date</span>
                          <b>{formatDisplayDate(loan.dueDate)}</b>
                        </div>
                        <div className="date-hover-row">
                          <span>Dissolve Date</span>
                          <b>{formatDisplayDate(loan.dissolveDate)}</b>
                        </div>
                      </div>
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
                );
              })}
          </div>
        </div>

        {pagination}
      </main>

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
        /* ---------- Sidebar buttons ---------- */
        .side-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #d4d4d8;
          font-size: 13.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .side-btn:hover {
          background: #27272a;
          color: #fff;
        }

        .side-btn:focus-visible {
          outline: 2px solid #f97316;
          outline-offset: 1px;
        }

        .side-btn-icon {
          width: 20px;
          flex-shrink: 0;
          text-align: center;
          font-size: 15px;
          line-height: 1;
        }

        .side-btn-primary {
          background: #f97316;
          color: #fff;
          font-weight: 600;
        }

        .side-btn-primary:hover {
          background: #ea580c;
          color: #fff;
        }

        .side-divider {
          height: 1px;
          background: #27272a;
          margin: 8px 4px;
        }

        /* Only the loan records area scrolls; the table header stays visible. */
        .loan-table-scroll {
          max-height: min(68vh, 760px);
          overflow-y: auto;
          overflow-x: auto;
          overscroll-behavior-y: auto;
          scrollbar-gutter: stable;
        }

        .loan-header-row {
          position: sticky;
          top: 0;
          z-index: 5;
          background: #111113;
        }

        input:focus {
          border-color: #f97316 !important;
        }

        .date-hover-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          padding: 10px 14px;
          min-width: 190px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.5);
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 30;
        }

        .date-hover-wrap:hover .date-hover-tooltip {
          opacity: 1;
          transform: translateY(0);
        }

        .date-hover-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 4px 0;
          color: #a1a1aa;
          font-size: 12px;
          font-weight: 400;
        }

        .date-hover-row b {
          color: #fff;
          font-weight: 600;
        }

        /* ==========================================
           GLOBAL FONT SIZE INCREASE — 30% (desktop)
        ========================================== */

        .loan-page h2 {
          font-size: 28.6px !important;
        }

        .loan-page .side-btn {
          font-size: 17.55px !important;
        }

        .loan-page label {
          font-size: 13.65px !important;
        }

        .loan-page input {
          font-size: 16.9px !important;
        }

        .loan-page .loan-row > button {
          font-size: 14.3px !important;
        }

        .loan-page .loan-row > div {
          font-size: 18.2px !important;
        }

        .loan-page .loan-row > div div,
        .loan-page .loan-row > div span {
          font-size: 13.65px !important;
        }

        .loan-page .date-hover-row {
          font-size: 15.6px !important;
        }

        /* Narrow desktop / tablet */
        @media (max-width: 1000px) {
          .filters-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .filters-grid-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            justify-content: start !important;
          }

          .filters-clear-btn {
            grid-column: 1 / -1;
            width: 100% !important;
          }
        }

        /* Touch tablets: no hover, so show due + dissolve dates inline */
        @media (hover: none) {
          .date-hover-tooltip {
            position: static;
            opacity: 1;
            transform: none;
            min-width: 0;
            margin-top: 6px;
            padding: 6px 10px;
            box-shadow: none;
            pointer-events: none;
          }

          .loan-page .date-hover-row {
            font-size: 12px !important;
            gap: 10px;
            padding: 2px 0;
          }
        }
      `}</style>
    </div>
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
      padding: "12px",
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: "440px",
        maxHeight: "88vh",
        overflowY: "auto",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "20px",
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
          aria-label="Close"
          style={{
            border: "none",
            background: "transparent",
            color: "#71717a",
            fontSize: "18px",
            cursor: "pointer",
            lineHeight: 1,
            padding: "8px",
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
            Enter your admin password to view loan totals, this month's
            activity, and overdue / past-dissolve counts.
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
                fontSize: "16px", // 16px stops iOS Safari zooming on focus
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

          <SectionLabel>{financials.monthLabel || "This Month"}</SectionLabel>
          <FinancialsRow
            label="Interest Accrued"
            value={financials.monthlyInterest}
            color="#f59e0b"
          />
          <FinancialsRow
            label="Amount Disbursed"
            value={financials.monthlyDisbursed}
            color="#ef4444"
          />
          <FinancialsRow
            label="Amount Collected"
            value={financials.monthlyCollected}
            color="#22c55e"
          />

          <SectionLabel>Overdue (Due Date Passed)</SectionLabel>
          <FinancialsCountRow
            count={financials.overdueCount}
            amount={financials.overdueLoanAmount}
            color="#ef4444"
          />

          <SectionLabel>Past Dissolve Date</SectionLabel>
          <FinancialsCountRow
            count={financials.pastDissolveCount}
            amount={financials.pastDissolveLoanAmount}
            color="#a855f7"
          />

          <SectionLabel>Due Within 7 Days</SectionLabel>
          <FinancialsCountRow
            count={financials.dueSoonCount}
            amount={financials.dueSoonLoanAmount}
            color="#f59e0b"
          />

          <SectionLabel>Portfolio Health</SectionLabel>
          <FinancialsRow
            label="Collection Rate"
            value={`${financials.collectionRate}%`}
            color={financials.collectionRate >= 50 ? "#22c55e" : "#ef4444"}
            raw
          />
          <FinancialsRow
            label="Total Gold Pledged"
            value={`${financials.totalGoldWeight} g`}
            color="#fbbf24"
            raw
          />
          <FinancialsRow
            label="Total Silver Pledged"
            value={`${financials.totalSilverWeight} g`}
            color="#e4e4e7"
            raw
          />
        </div>
      )}
    </div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div
    style={{
      color: "#71717a",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      marginTop: "10px",
      marginBottom: "-2px",
    }}
  >
    {children}
  </div>
);

const FinancialsRow = ({ label, value, color = "#22c55e", raw = false }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "8px",
      gap: "12px",
    }}
  >
    <span style={{ color: "#a1a1aa", fontSize: "13px" }}>{label}</span>
    <span
      style={{
        color,
        fontSize: "16px",
        fontWeight: "700",
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {raw ? value : `₹${Number(value || 0).toFixed(2)}`}
    </span>
  </div>
);

const FinancialsCountRow = ({ count, amount, color = "#ef4444" }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
      background: "#09090b",
      border: "1px solid #27272a",
      borderRadius: "8px",
      gap: "12px",
    }}
  >
    <span style={{ color: "#a1a1aa", fontSize: "13px" }}>
      {Number(count || 0)} loan{Number(count || 0) === 1 ? "" : "s"}
    </span>
    <span
      style={{
        color,
        fontSize: "16px",
        fontWeight: "700",
        whiteSpace: "nowrap",
      }}
    >
      ₹{Number(amount || 0).toFixed(2)}
    </span>
  </div>
);

// =========================================================
// STYLES
// =========================================================

const pageStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "20px",
  width: "100%",
  maxWidth: "none",
  margin: "24px 0",
  padding: "0 20px 40px",
  boxSizing: "border-box",
};

const sidebarStyle = {
  position: "sticky",
  top: "20px",
  width: "210px",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "10px",
  background: "#111113",
  border: "1px solid #27272a",
  borderRadius: "12px",
  boxSizing: "border-box",
};

const mainStyle = {
  flex: 1,
  minWidth: 0,
  width: "100%",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#a1a1aa",
  fontSize: "10.5px",
  fontWeight: "600",
};

const mobileLabelStyle = {
  display: "block",
  marginBottom: "5px",
  color: "#a1a1aa",
  fontSize: "11.5px",
  fontWeight: "600",
};

const inputStyle = {
  width: "100%",
  height: "44px",
  padding: "0 13px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  minWidth: 0,
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

const cardStyle = {
  background: "#2a2a33",
  border: "1px solid #52525b",
  borderRadius: "12px",
  padding: "16px",
  boxSizing: "border-box",
  width: "100%",
  boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
};

const cardLabelStyle = {
  color: "#c4c4cc",
  fontSize: "10.5px",
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

const primaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: "7px",
  border: "none",
  background: "#f97316",
  color: "#fff",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
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