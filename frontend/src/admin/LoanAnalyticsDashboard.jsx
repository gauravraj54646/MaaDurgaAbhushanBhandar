import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

// -----------------------------------------------------------
// Colors — kept consistent with the rest of the admin UI
// (orange accent #f97316, dark #09090b / #111113 / #18181b panels).
// -----------------------------------------------------------
const COLORS = {
  orange: "#f97316",
  amber: "#f59e0b",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#a855f7",
  teal: "#14b8a6",
  zinc: "#71717a",
  gold: "#fbbf24",
  silver: "#e4e4e7",
};

const STATUS_COLORS = {
  Active: COLORS.green,
  "Due Soon": COLORS.amber,
  Overdue: COLORS.red,
  "Past Dissolve": COLORS.purple,
  Returned: COLORS.teal,
};

const inr = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getCurrentMonthValue = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

// Human-readable "August 2026" from a "2026-08" <input type="month"> value.
const formatMonthLabel = (monthValue) => {
  if (!monthValue) return "";
  const [y, m] = monthValue.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

// Human-readable "17 Aug 2026" from a "2026-08-17" <input type="date"> value.
const formatDateLabel = (dateValue) => {
  if (!dateValue) return "";
  const [y, m, d] = dateValue.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Builds the label for whichever period is currently selected, so the
// UI can show it immediately without waiting on the backend's
// periodLabel (which may not account for custom from/to ranges).
const buildPeriodLabel = (mode, monthValue, rangeFrom, rangeTo) => {
  if (mode === "range" && rangeFrom && rangeTo) {
    return `${formatDateLabel(rangeFrom)} – ${formatDateLabel(rangeTo)}`;
  }
  return formatMonthLabel(monthValue);
};

// -----------------------------------------------------------
// Back arrow button — matches the one used on Manage Loans.
// -----------------------------------------------------------
const BackButton = ({ onClick, title = "Back" }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    style={{
      flexShrink: 0,
      width: "38px",
      height: "38px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "8px",
      border: "1px solid #3f3f46",
      background: "transparent",
      color: "#e4e4e7",
      cursor: "pointer",
      padding: 0,
      transition:
        "border-color 0.15s ease, color 0.15s ease, background 0.15s ease",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = "#f97316";
      e.currentTarget.style.color = "#f97316";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = "#3f3f46";
      e.currentTarget.style.color = "#e4e4e7";
    }}
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  </button>
);

const LoanAnalyticsDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // Kept only in memory after a successful verify, so changing the
  // reporting period can re-fetch without asking for the password
  // again. Never rendered back into the password input.
  const [verifiedPassword, setVerifiedPassword] = useState("");

  // Period selector — "month" uses a native <input type="month">;
  // "range" uses explicit from/to dates.
  const [periodMode, setPeriodMode] = useState("month");
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeError, setRangeError] = useState("");

  // Label for whichever period is actually applied/fetched right now —
  // computed on the frontend so a custom date range is always visible,
  // even if the backend's periodLabel only ever describes months.
  const [appliedPeriodLabel, setAppliedPeriodLabel] = useState(
    buildPeriodLabel("month", getCurrentMonthValue(), "", ""),
  );

  // Lock page scroll while the password gate is showing so the
  // centered card doesn't sit alongside a scrollbar with nothing
  // to scroll to. Restored once the dashboard (with its charts)
  // is rendered.
  useEffect(() => {
    if (!data) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [data]);

  const buildPeriodPayload = () => {
    if (periodMode === "range" && rangeFrom && rangeTo) {
      return { fromDate: rangeFrom, toDate: rangeTo };
    }
    return { month: monthValue };
  };

  const fetchFinancials = async (pwd) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/loans/analytics/financials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: pwd, ...buildPeriodPayload() }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server did not return JSON (status ${res.status}). Check the API server is running.`,
        );
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Verification failed.");
      }

      setData(json);
      // Lock in the label for the period we just fetched, based on
      // whatever mode/values were active at request time.
      setAppliedPeriodLabel(
        buildPeriodLabel(periodMode, monthValue, rangeFrom, rangeTo),
      );
      return true;
    } catch (err) {
      setError(err.message || "Something went wrong.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();

    if (!password) {
      setError("Enter your password.");
      return;
    }

    const ok = await fetchFinancials(password);

    if (ok) {
      setVerifiedPassword(password);
      setPassword("");
    }
  };

  // Re-fetches with the current period selection, reusing the
  // password captured at unlock time — no re-prompt needed.
  const applyPeriod = () => {
    if (periodMode === "range") {
      if (!rangeFrom || !rangeTo) {
        setRangeError("Pick both a from date and a to date.");
        return;
      }
      if (new Date(rangeFrom).getTime() > new Date(rangeTo).getTime()) {
        setRangeError("From date must be before the to date.");
        return;
      }
    }

    setRangeError("");
    fetchFinancials(verifiedPassword);
  };

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // -----------------------------------------------------------
  // Gate: centered, fixed password screen shown before any
  // analytics data is fetched/rendered — no page scroll, no
  // scrollbar, card stays pinned to the middle of the viewport.
  // -----------------------------------------------------------
  if (!data) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
          background: "#000",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <BackButton
            onClick={() => navigate("/admin/loan/products")}
            title="Back to Manage Loans"
          />

          <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>
            Loan Analytics
          </h2>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            padding: "26px",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "12px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ color: "#71717a", fontSize: "13px", marginBottom: "16px" }}>
            Enter your admin password to view the full financial and
            portfolio analytics.
          </div>

          <form onSubmit={verify}>
            <input
              type="password"
              placeholder="Admin password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <div style={{ color: "#ef4444", fontSize: "12.5px", marginBottom: "10px" }}>
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
              {loading ? "Verifying..." : "View Analytics"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Full dashboard — normal scrollable page once verified.
  // -----------------------------------------------------------
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
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <BackButton
          onClick={() => navigate("/admin/loan/products")}
          title="Back to Manage Loans"
        />

        <h2 style={{ color: "#f97316", margin: 0, fontSize: "22px" }}>
          Loan Analytics
        </h2>
      </div>

      <PeriodSelector
        periodMode={periodMode}
        setPeriodMode={setPeriodMode}
        monthValue={monthValue}
        setMonthValue={setMonthValue}
        rangeFrom={rangeFrom}
        setRangeFrom={setRangeFrom}
        rangeTo={rangeTo}
        setRangeTo={setRangeTo}
        onApply={applyPeriod}
        loading={loading}
        error={rangeError}
        appliedPeriodLabel={appliedPeriodLabel}
      />

      <Dashboard data={data} loading={loading} appliedPeriodLabel={appliedPeriodLabel} />
    </div>
  );
};

// =========================================================
// PERIOD SELECTOR
// =========================================================

const PeriodSelector = ({
  periodMode,
  setPeriodMode,
  monthValue,
  setMonthValue,
  rangeFrom,
  setRangeFrom,
  rangeTo,
  setRangeTo,
  onApply,
  loading,
  error,
  appliedPeriodLabel,
}) => (
  <div
    style={{
      background: "#0f0f11",
      border: "1px solid #27272a",
      borderRadius: "12px",
      padding: "16px 18px",
      marginBottom: "22px",
    }}
  >
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginBottom: "12px",
      }}
    >
      <ModeButton
        active={periodMode === "month"}
        onClick={() => setPeriodMode("month")}
        text="By Month"
      />
      <ModeButton
        active={periodMode === "range"}
        onClick={() => setPeriodMode("range")}
        text="Custom Range"
      />
    </div>

    <div
      className="period-selector-row"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      {periodMode === "month" ? (
        <div>
          <label style={labelStyle}>Month</label>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          />
        </div>
      ) : (
        <>
          <div>
            <label style={labelStyle}>From Date</label>
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
          </div>
          <div>
            <label style={labelStyle}>To Date</label>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        style={{
          height: "42px",
          padding: "0 20px",
          borderRadius: "7px",
          border: "none",
          background: loading ? "#52525b" : "#f97316",
          color: "#fff",
          fontWeight: "600",
          fontSize: "13.5px",
          cursor: loading ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "Loading..." : "Apply"}
      </button>
    </div>

    {error && (
      <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "10px" }}>
        {error}
      </div>
    )}

    {/* Always-visible confirmation of whichever period is currently
        applied — including a custom from/to range. */}
    {appliedPeriodLabel && (
      <div
        style={{
          marginTop: "12px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "999px",
          background: "rgba(249,115,22,0.1)",
          border: "1px solid rgba(249,115,22,0.35)",
          color: "#f97316",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        Showing: {appliedPeriodLabel}
      </div>
    )}
  </div>
);

const ModeButton = ({ active, onClick, text }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: "8px 14px",
      borderRadius: "7px",
      border: active ? "1px solid #f97316" : "1px solid #3f3f46",
      background: active ? "rgba(249,115,22,0.12)" : "transparent",
      color: active ? "#f97316" : "#a1a1aa",
      fontSize: "12.5px",
      fontWeight: "600",
      cursor: "pointer",
    }}
  >
    {text}
  </button>
);

// =========================================================
// DASHBOARD
// =========================================================

const Dashboard = ({ data, loading, appliedPeriodLabel }) => {
  const statusData = [
    { name: "Active", value: data.activeCount, amount: data.activeLoanAmount },
    { name: "Due Soon", value: data.dueSoonCount, amount: data.dueSoonLoanAmount },
    { name: "Overdue", value: data.overdueCount, amount: data.overdueLoanAmount },
    {
      name: "Past Dissolve",
      value: data.pastDissolveCount,
      amount: data.pastDissolveLoanAmount,
    },
    {
      name: "Returned",
      value: data.returnedCount,
      amount: data.returnedLoanAmount,
    },
  ].filter((d) => d.value > 0);

  const collateralData = [
    { name: "Gold (g)", value: data.totalGoldWeight, color: COLORS.gold },
    { name: "Silver (g)", value: data.totalSilverWeight, color: COLORS.silver },
  ].filter((d) => d.value > 0);

  // Prefer the frontend-computed label (always correct for custom
  // ranges) and fall back to whatever the backend sent, if any.
  const periodHeading = appliedPeriodLabel || data.periodLabel || "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      {/* ---------------- PORTFOLIO TOTALS (all-time) ---------------- */}
      <SectionCard title="Portfolio Totals (All-Time)">
        <div className="analytics-summary-grid" style={summaryGridStyle}>
          <StatCard label="Total Loan Amount" value={inr(data.totalLoanAmount)} />
          <StatCard
            label="Total Interest"
            value={inr(data.totalInterest)}
            color={COLORS.amber}
          />
          <StatCard
            label="Total Outstanding"
            value={inr(data.totalOutstanding)}
            color={COLORS.red}
          />
          <StatCard
            label="Total Collected"
            value={inr(data.totalCollected)}
            color={COLORS.green}
          />
          <StatCard
            label="Collection Rate"
            value={`${data.collectionRate}%`}
            color={data.collectionRate >= 50 ? COLORS.green : COLORS.red}
          />
        </div>
      </SectionCard>

      {/* ---------------- SELECTED PERIOD ---------------- */}
      <SectionCard title={`Selected Period — ${periodHeading}`}>
        <div className="analytics-month-grid" style={monthGridStyle}>
          <StatCard
            label="Interest Accrued"
            value={inr(data.periodInterest)}
            color={COLORS.amber}
            compact
          />
          <StatCard
            label="Amount Disbursed"
            value={inr(data.periodDisbursed)}
            color={COLORS.red}
            compact
          />
          <StatCard
            label="Amount Collected"
            value={inr(data.periodCollected)}
            color={COLORS.green}
            compact
          />
          <StatCard
            label="Loans Returned"
            value={`${data.periodReturnedCount}`}
            color={COLORS.teal}
            compact
          />
          <StatCard
            label="Amount Returned"
            value={inr(data.periodReturnedAmount)}
            color={COLORS.teal}
            compact
          />
        </div>
      </SectionCard>

      {/* ---------------- STATUS + COLLATERAL PIE CHARTS ---------------- */}
      <div className="analytics-pie-grid" style={pieGridStyle}>
        <SectionCard title="Loan Status Breakdown (Current)">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name, props) => [
                    `${value} loans · ${inr(props.payload.amount)}`,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="No loans yet." />
          )}
        </SectionCard>

        <SectionCard title="Collateral Split (by weight)">
          {collateralData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={collateralData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}g`}
                  labelLine={false}
                >
                  {collateralData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => `${value} g`}
                />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="No gold/silver weight recorded." />
          )}
        </SectionCard>
      </div>

      {/* ---------------- 6-MONTH TREND ---------------- */}
      <SectionCard title="6-Month Trend — Disbursed vs Collected vs Returned">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthlyTrend} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => inr(value)} />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
            <Bar dataKey="disbursed" name="Disbursed" fill={COLORS.red} radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" name="Collected" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="returned" name="Returned" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* ---------------- 6-MONTH INTEREST TREND ---------------- */}
      <SectionCard title="6-Month Trend — Interest Accrued">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => inr(value)} />
            <Line
              type="monotone"
              dataKey="interest"
              name="Interest Accrued"
              stroke={COLORS.amber}
              strokeWidth={2.5}
              dot={{ r: 4, fill: COLORS.amber }}
            />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>

      <style>{`
        @media (max-width: 900px) {
          .analytics-pie-grid { grid-template-columns: 1fr !important; }
          .analytics-summary-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .analytics-month-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .period-selector-row { align-items: stretch !important; }
        }
      `}</style>
    </div>
  );
};

// =========================================================
// SMALL COMPONENTS
// =========================================================

const SectionCard = ({ title, children }) => (
  <div
    style={{
      padding: "20px",
      border: "1px solid #27272a",
      borderRadius: "10px",
      background: "#111113",
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
      {title}
    </div>
    {children}
  </div>
);

const StatCard = ({ label, value, color = "#fff", compact = false }) => (
  <div
    style={{
      padding: compact ? "12px" : "16px 14px",
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
        fontSize: compact ? "15px" : "18px",
        fontWeight: "700",
        wordBreak: "break-word",
      }}
    >
      {value}
    </div>
  </div>
);

const EmptyChart = ({ text }) => (
  <div
    style={{
      height: "280px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#52525b",
      fontSize: "13px",
    }}
  >
    {text}
  </div>
);

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12.5px",
};

// =========================================================
// STYLES
// =========================================================

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(140px, 1fr))",
  gap: "12px",
};

const monthGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
  gap: "12px",
};

const pieGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "18px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: "#a1a1aa",
  fontSize: "10.5px",
  fontWeight: "600",
};

const inputStyle = {
  height: "42px",
  padding: "0 12px",
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: "7px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

export default LoanAnalyticsDashboard;