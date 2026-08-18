const bcrypt = require('bcryptjs');
const LoanProduct = require('../models/LoanProduct');
const User = require('../models/User');
const { getLoanSummary } = require('../utils/loanCalculations');

// =========================================================
// Date helpers
// =========================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Parses a value into a *local* Date, regardless of whether it's
// already a Date object, a full ISO timestamp, or a bare
// "YYYY-MM-DD" string. This matters because `new Date("2026-08-17")`
// is parsed as UTC midnight by the JS spec, while
// `new Date("2026-08-17T10:00:00")` and `new Date(dateObj)` are
// parsed/kept in local time. Mixing those two behaviors is what
// causes off-by-one-day bugs near period boundaries when the server
// isn't running in UTC. Routing every date through this first makes
// all downstream comparisons consistent.
const toLocalDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());

  if (typeof value === 'string') {
    const bareDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (bareDateMatch) {
      const [, y, m, d] = bareDateMatch;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
  }

  return new Date(value);
};

const startOfDay = (value) => {
  const d = toLocalDate(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = toLocalDate(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Interest accrued on one amount as of a given date, using the same
// formula as the client. Returns 0 if `asOfDate` is before the item
// was actually issued (rather than applying the 30-day minimum to
// something that doesn't exist yet).
const interestAsOf = (amount, roi, issueDate, asOfDate) => {
  if (!issueDate) return 0;

  const issue = startOfDay(issueDate);
  const asOf = startOfDay(asOfDate);

  if (asOf.getTime() < issue.getTime()) return 0;

  const days = Math.max(30, Math.floor((asOf.getTime() - issue.getTime()) / MS_PER_DAY));
  return (Number(amount || 0) * Number(roi || 0) * days) / 3000;
};

const isBeforeDay = (value, boundaryDayStart) => {
  if (!value) return false;
  return startOfDay(value).getTime() < boundaryDayStart.getTime();
};

// True if `value`'s calendar day falls within [rangeStart, rangeEnd]
// inclusive on both ends.
const isWithinDayRange = (value, rangeStart, rangeEnd) => {
  if (!value) return false;
  const day = startOfDay(value).getTime();
  return day >= rangeStart.getTime() && day <= rangeEnd.getTime();
};

// True if a raw timestamp (not just calendar day) falls within
// [rangeStart, rangeEnd] inclusive. Used for arbitrary period
// (month or custom from/to) filtering of disbursed/collected/returned.
// `value` is routed through toLocalDate first so a bare "YYYY-MM-DD"
// returnDate/dueDate compares correctly against locally-built period
// boundaries instead of being parsed as UTC.
const isWithinRange = (value, rangeStart, rangeEnd) => {
  if (!value) return false;
  const t = toLocalDate(value).getTime();
  return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// -----------------------------------------------------------
// Resolves the selected reporting period from the request body.
// Priority: explicit fromDate+toDate range > a specific "YYYY-MM"
// month > default to the current month.
// -----------------------------------------------------------
const resolvePeriod = (month, fromDate, toDate) => {
  if (fromDate && toDate) {
    const periodStart = startOfDay(fromDate);
    const periodEnd = endOfDay(toDate);
    const label = `${periodStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${periodEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    return { periodStart, periodEnd, label };
  }

  let year;
  let monthIndex;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    year = y;
    monthIndex = m - 1;
  } else {
    const today = new Date();
    year = today.getFullYear();
    monthIndex = today.getMonth();
  }

  const periodStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const periodEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const label = `${MONTH_NAMES[monthIndex]} ${year}`;

  return { periodStart, periodEnd, label };
};

// -----------------------------------------------------------
// Bucket a single loan into exactly one status category as of
// today. "returned" takes priority over everything else since a
// returned loan is closed regardless of what its due/dissolve
// dates say. Buckets are mutually exclusive so they sum to the
// total loan count — useful for a clean pie chart.
//
// NOTE: this is the current, all-time snapshot (any loan ever
// returned counts here) and is intentionally NOT scoped to the
// selected period — that's what makes it a snapshot rather than a
// period stat. The period-scoped return figures are computed
// separately below via isWithinRange(loan.returnDate, ...).
// -----------------------------------------------------------
const categorizeLoanStatus = (loan, todayStart, sevenDaysOut) => {
  if (loan.returnDate) return 'returned';
  if (isBeforeDay(loan.dissolveDate, todayStart)) return 'pastDissolve';
  if (isBeforeDay(loan.dueDate, todayStart)) return 'overdue';
  if (isWithinDayRange(loan.dueDate, todayStart, sevenDaysOut)) return 'dueSoon';
  return 'active';
};

// -----------------------------------------------------------
// Builds a 6-month trailing trend (disbursed / collected / interest
// accrued / returned) ending at the month containing `periodEnd`.
// Each loan/reloan/payment/return is bucketed into whichever
// trend month its date falls in.
// -----------------------------------------------------------
const buildMonthlyTrend = (loans, summaries, periodEnd) => {
  const months = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const d = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - offset, 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    months.push({
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      start: mStart,
      end: mEnd,
      disbursed: 0,
      collected: 0,
      interest: 0,
      returned: 0,
    });
  }

  loans.forEach((loan, idx) => {
    months.forEach((m) => {
      // Disbursed
      if (isWithinRange(loan.date, m.start, m.end)) {
        m.disbursed += Number(loan.loanAmount || 0);
      }
      (loan.reloans || []).forEach((r) => {
        if (isWithinRange(r.issueDate, m.start, m.end)) {
          m.disbursed += Number(r.amount || 0);
        }
      });

      // Collected
      (loan.payments || []).forEach((p) => {
        if (isWithinRange(p.paidDate, m.start, m.end)) {
          m.collected += Number(p.paidAmount || 0);
        }
      });

      // Interest accrued during this month (marginal)
      m.interest += Math.max(
        0,
        interestAsOf(loan.loanAmount, loan.roi, loan.date, m.end)
          - interestAsOf(loan.loanAmount, loan.roi, loan.date, m.start),
      );
      (loan.reloans || []).forEach((r) => {
        m.interest += Math.max(
          0,
          interestAsOf(r.amount, loan.roi, r.issueDate, m.end)
            - interestAsOf(r.amount, loan.roi, r.issueDate, m.start),
        );
      });

      // Returned — only loans with an actual returnDate can land here,
      // since isWithinRange short-circuits to false on a falsy value.
      if (isWithinRange(loan.returnDate, m.start, m.end)) {
        m.returned += summaries[idx].grandLoanAmount;
      }
    });
  });

  return months.map((m) => ({
    month: m.label,
    disbursed: Number(m.disbursed.toFixed(2)),
    collected: Number(m.collected.toFixed(2)),
    interest: Number(m.interest.toFixed(2)),
    returned: Number(m.returned.toFixed(2)),
  }));
};

// -----------------------------------------------------------
// Lightweight, unauthenticated-financials counts for the admin
// dashboard header (total / available / signed loans). No password
// gate — these numbers alone don't reveal money figures.
// -----------------------------------------------------------
const getLoanAnalytics = async (req, res) => {
  try {
    const [totalLoans, availableLoans, returnedLoans, signedLoans] = await Promise.all([
      LoanProduct.countDocuments({ isDeleted : false }),
      LoanProduct.countDocuments({ isDeleted : false, returnDate:  null , }),
      LoanProduct.countDocuments({ isDeleted : false, returnDate:  {$ne :null} , }),
      LoanProduct.countDocuments({ isDeleted : false, signed: 'yes' }),
    ]);

    res.json({ totalLoans, availableLoans, returnedLoans, signedLoans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------------
// Re-verifies the logged-in admin's password before releasing the
// financial totals. Accepts an optional reporting period via
// `month` ("YYYY-MM") or `fromDate` + `toDate` — defaults to the
// current month when neither is supplied.
//
// NOTE: assumes your User model stores a bcrypt-hashed `password`
// field with `select: false`, and that `protect` middleware sets
// `req.user` from the JWT. Adjust the bcrypt.compare call below if
// your User model already exposes its own comparison method
// (e.g. `user.matchPassword(...)`) instead.
// -----------------------------------------------------------
const getLoanFinancials = async (req, res) => {
  try {
    const { password, month, fromDate, toDate } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const admin = await User.findById(req.user._id).select('+password');

    if (!admin) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const loans = await LoanProduct.find({isDeleted: false,}).select(
      'loanAmount date roi reloans payments dueDate dissolveDate returnDate goldWeight silverWeight',
    );

    const today = new Date();
    const todayStart = startOfDay(today);

    const sevenDaysOut = new Date(todayStart);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const { periodStart, periodEnd, label: periodLabel } = resolvePeriod(month, fromDate, toDate);

    // Pre-compute each loan's summary once — reused for totals,
    // status buckets, and the trend builder.
    const summaries = loans.map((loan) => getLoanSummary(loan));

    let totalLoanAmount = 0;
    let totalInterest = 0;
    let totalOutstanding = 0;

    let periodInterest = 0;
    let periodDisbursed = 0;
    let periodCollected = 0;
    let periodReturnedCount = 0;
    let periodReturnedAmount = 0;

    let totalGoldWeight = 0;
    let totalSilverWeight = 0;

    let totalPrincipalDisbursed = 0;
    let totalPaidAcrossAllLoans = 0;

    const statusBuckets = {
      active: { count: 0, amount: 0 },
      dueSoon: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      pastDissolve: { count: 0, amount: 0 },
      returned: { count: 0, amount: 0 },
    };

    loans.forEach((loan, idx) => {
      const summary = summaries[idx];

      totalLoanAmount += summary.grandLoanAmount;
      totalInterest += summary.grandInterest;
      totalOutstanding += summary.finalAmount;

      // ---- Selected period: interest accrued (marginal) ----
      periodInterest += Math.max(
        0,
        interestAsOf(loan.loanAmount, loan.roi, loan.date, periodEnd)
          - interestAsOf(loan.loanAmount, loan.roi, loan.date, periodStart),
      );
      (loan.reloans || []).forEach((r) => {
        periodInterest += Math.max(
          0,
          interestAsOf(r.amount, loan.roi, r.issueDate, periodEnd)
            - interestAsOf(r.amount, loan.roi, r.issueDate, periodStart),
        );
      });

      // ---- Selected period: amount disbursed ----
      if (isWithinRange(loan.date, periodStart, periodEnd)) {
        periodDisbursed += Number(loan.loanAmount || 0);
      }
      (loan.reloans || []).forEach((r) => {
        if (isWithinRange(r.issueDate, periodStart, periodEnd)) {
          periodDisbursed += Number(r.amount || 0);
        }
      });

      // ---- Selected period: amount collected ----
      (loan.payments || []).forEach((p) => {
        if (isWithinRange(p.paidDate, periodStart, periodEnd)) {
          periodCollected += Number(p.paidAmount || 0);
        }
      });

      // ---- Selected period: loans returned ----
      // Only loans whose returnDate is set AND falls inside the
      // selected period count here. isWithinRange returns false
      // immediately for a null/undefined/empty returnDate, so a
      // loan that's still open never contributes to these totals.
      if (isWithinRange(loan.returnDate, periodStart, periodEnd)) {
        periodReturnedCount += 1;
        periodReturnedAmount += summary.grandLoanAmount;
      }

      // ---- Current status snapshot (unaffected by selected period) ----
      const status = categorizeLoanStatus(loan, todayStart, sevenDaysOut);
      statusBuckets[status].count += 1;
      statusBuckets[status].amount += summary.grandLoanAmount;

      // ---- Collateral totals ----
      totalGoldWeight += Number(loan.goldWeight || 0);
      totalSilverWeight += Number(loan.silverWeight || 0);

      // ---- Collection rate inputs: principal only (loanAmount +
      // reloan amounts), not interest, vs total paid ----
      const reloanPrincipal = (loan.reloans || []).reduce(
        (s, r) => s + Number(r.amount || 0),
        0,
      );
      totalPrincipalDisbursed += Number(loan.loanAmount || 0) + reloanPrincipal;

      totalPaidAcrossAllLoans += (loan.payments || []).reduce(
        (s, p) => s + Number(p.paidAmount || 0),
        0,
      );
    });

    const collectionRate =
      totalPrincipalDisbursed > 0
        ? (totalPaidAcrossAllLoans / totalPrincipalDisbursed) * 100
        : 0;

    const monthlyTrend = buildMonthlyTrend(loans, summaries, periodEnd);

    res.json({
      // ---- Portfolio totals (all-time, unaffected by period) ----
      totalLoanAmount: Number(totalLoanAmount.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      totalCollected: Number(totalPaidAcrossAllLoans.toFixed(2)),
      collectionRate: Number(collectionRate.toFixed(1)),

      totalGoldWeight: Number(totalGoldWeight.toFixed(3)),
      totalSilverWeight: Number(totalSilverWeight.toFixed(3)),

      // ---- Selected period ----
      periodLabel,
      periodStart,
      periodEnd,
      periodInterest: Number(periodInterest.toFixed(2)),
      periodDisbursed: Number(periodDisbursed.toFixed(2)),
      periodCollected: Number(periodCollected.toFixed(2)),
      periodReturnedCount,
      periodReturnedAmount: Number(periodReturnedAmount.toFixed(2)),

      // ---- Current status snapshot ----
      activeCount: statusBuckets.active.count,
      activeLoanAmount: Number(statusBuckets.active.amount.toFixed(2)),

      dueSoonCount: statusBuckets.dueSoon.count,
      dueSoonLoanAmount: Number(statusBuckets.dueSoon.amount.toFixed(2)),

      overdueCount: statusBuckets.overdue.count,
      overdueLoanAmount: Number(statusBuckets.overdue.amount.toFixed(2)),

      pastDissolveCount: statusBuckets.pastDissolve.count,
      pastDissolveLoanAmount: Number(statusBuckets.pastDissolve.amount.toFixed(2)),

      returnedCount: statusBuckets.returned.count,
      returnedLoanAmount: Number(statusBuckets.returned.amount.toFixed(2)),

      // ---- 6-month trailing trend, ending at the selected period's month ----
      monthlyTrend,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getLoanAnalytics,
  getLoanFinancials,
};