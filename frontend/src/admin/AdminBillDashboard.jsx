import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const AdminBillDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalBills: 0,
    pendingBills: 0,
    partialBills: 0,
    loading: true,
    error: "",
  });

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }

    const loadStats = async () => {
      try {
        const headers = { Authorization: `Bearer ${user.token}` };

        const [allRes, pendingRes, partialRes] = await Promise.all([
          fetch("/api/bills?limit=1", { headers }),
          fetch("/api/bills?limit=1&paymentStatus=pending", { headers }),
          fetch("/api/bills?limit=1&paymentStatus=partial", { headers }),
        ]);

        const [all, pending, partial] = await Promise.all([
          allRes.json(),
          pendingRes.json(),
          partialRes.json(),
        ]);

        if (!allRes.ok) throw new Error(all.message || "Failed to load stats");

        setStats({
          totalBills: all.total || 0,
          pendingBills: pending.total || 0,
          partialBills: partial.total || 0,
          loading: false,
          error: "",
        });
      } catch (error) {
        setStats((prev) => ({ ...prev, loading: false, error: error.message }));
      }
    };

    loadStats();
  }, [user, navigate]);

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="abd-wrap">
      <div className="abd-head">
        <h2 className="abd-title">Bill Management</h2>

        <button
          type="button"
          className="abd-primary-btn"
          onClick={() => navigate("/admin/bill/add-bill")}
        >
          + Create New Bill
        </button>
      </div>

      {stats.error && <div className="abd-error">{stats.error}</div>}

      <div className="abd-stats">
        <StatCard
          label="Total Bills"
          value={stats.loading ? "..." : stats.totalBills}
          color="#f97316"
        />
        <StatCard
          label="Partially Paid"
          value={stats.loading ? "..." : stats.partialBills}
          color="#f59e0b"
        />
        <StatCard
          label="Pending Payment"
          value={stats.loading ? "..." : stats.pendingBills}
          color="#ef4444"
        />
      </div>

      <div className="abd-actions">
        <ActionCard
          title="🧾 Create New Bill"
          description="Bill a customer for a new jewelry purchase."
          onClick={() => navigate("/admin/bill/add-bill")}
        />
        <ActionCard
          title="📄 Manage Bills"
          description="Search, filter, edit, or delete existing bills."
          onClick={() => navigate("/admin/bill/products")}
        />
      </div>

      <style>{`
        .abd-wrap {
          max-width: 1100px;
          margin: 30px auto;
          padding: 0 20px;
          box-sizing: border-box;
        }
        .abd-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 26px;
        }
        .abd-title { color: #f97316; margin: 0; font-size: 24px; }
        .abd-primary-btn {
          padding: 10px 18px;
          border-radius: 7px;
          border: none;
          background: #f97316;
          color: #fff;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .abd-error {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.08);
          color: #fca5a5;
          font-size: 13px;
        }
        .abd-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 26px;
        }
        .abd-stat {
          padding: 20px;
          background: #111113;
          border: 1px solid #27272a;
          border-radius: 10px;
          min-width: 0;
        }
        .abd-stat-label { color: #a1a1aa; font-size: 12.5px; margin-bottom: 8px; }
        .abd-stat-value { font-size: 26px; font-weight: 700; }
        .abd-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .abd-action {
          text-align: left;
          padding: 22px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 10px;
          cursor: pointer;
          color: #fff;
          font-family: inherit;
        }
        .abd-action-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        .abd-action-desc { color: #71717a; font-size: 13px; }

        @media (max-width: 700px) {
          .abd-wrap { margin: 12px auto; padding: 0 10px; }
          .abd-head { margin-bottom: 12px; gap: 8px; flex-wrap: nowrap; }
          .abd-title { font-size: 17px; }
          .abd-primary-btn { padding: 8px 12px; font-size: 12.5px; }
          .abd-error { margin-bottom: 10px; padding: 9px 11px; font-size: 12px; }

          /* 3 stats stay in one compact row */
          .abd-stats { gap: 8px; margin-bottom: 12px; }
          .abd-stat { padding: 10px 8px; text-align: center; }
          .abd-stat-label {
            font-size: 10.5px;
            margin-bottom: 4px;
            line-height: 1.25;
          }
          .abd-stat-value { font-size: 20px; }

          /* action cards: slim full-width rows */
          .abd-actions { grid-template-columns: 1fr; gap: 8px; }
          .abd-action { padding: 12px 14px; }
          .abd-action:active { background: #202024; }
          .abd-action-title { font-size: 14.5px; margin-bottom: 2px; }
          .abd-action-desc { font-size: 12px; }
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className="abd-stat">
    <div className="abd-stat-label">{label}</div>
    <div className="abd-stat-value" style={{ color }}>
      {value}
    </div>
  </div>
);

const ActionCard = ({ title, description, onClick }) => (
  <button type="button" onClick={onClick} className="abd-action">
    <div className="abd-action-title">{title}</div>
    <div className="abd-action-desc">{description}</div>
  </button>
);

export default AdminBillDashboard;