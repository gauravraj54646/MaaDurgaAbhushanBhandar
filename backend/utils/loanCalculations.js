/**
 * Shared loan interest calculation.
 * Mirrors the frontend's calculateLoan() exactly, so the number shown
 * in the UI and the number computed server-side never disagree.
 *
 * Interest is date-dependent (grows every day the loan is unpaid), so
 * it must NEVER be stored as a fixed field — always recompute against
 * "today" whenever a loan is read.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function calculateLoan(amount, issueDate, roi, asOf = new Date()) {
  const principal = Number(amount);
  const rate = Number(roi);

  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(rate) ||
    principal < 0 ||
    !issueDate
  ) {
    return { days: 0, interest: 0, total: 0 };
  }

  const loanDate = new Date(issueDate);
  const today = new Date(asOf);

  loanDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.max(
    30,
    Math.floor((today.getTime() - loanDate.getTime()) / MS_PER_DAY),
  );

  const interest = (principal * rate * diffDays) / 3000;
  const total = principal + interest;

  return {
    days: diffDays,
    interest: Number(interest.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

function getLoanSummary(loan, asOf = new Date()) {
  const original = calculateLoan(loan.loanAmount, loan.date, loan.roi, asOf);

  const reloanCalcs = (loan.reloans || []).map((r) =>
    calculateLoan(r.amount, r.issueDate, loan.roi, asOf),
  );

  const reloanAmount = (loan.reloans || []).reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  const reloanInterest = reloanCalcs.reduce((sum, c) => sum + c.interest, 0);
  const reloanTotal = reloanCalcs.reduce((sum, c) => sum + c.total, 0);

  const totalPaid = (loan.payments || []).reduce(
    (sum, p) => sum + Number(p.paidAmount || 0),
    0,
  );

  const grandLoanAmount = Number(loan.loanAmount || 0) + reloanAmount;
  const grandInterest = original.interest + reloanInterest;
  const grandTotal = Number((original.total + reloanTotal).toFixed(2));
  const finalAmount = Number((grandTotal - totalPaid).toFixed(2));

  return {
    original,
    reloans: reloanCalcs,
    reloanAmount,
    reloanInterest: Number(reloanInterest.toFixed(2)),
    reloanTotal: Number(reloanTotal.toFixed(2)),
    totalPaid,
    grandLoanAmount,
    grandInterest: Number(grandInterest.toFixed(2)),
    grandTotal,
    finalAmount,
    asOf,
  };
}

module.exports = { calculateLoan, getLoanSummary };