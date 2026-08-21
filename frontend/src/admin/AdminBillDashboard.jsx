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
    <div
      style={{
        maxWidth: "1100px",
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
          marginBottom: "26px",
        }}
      >
        <h2 style={{ color: "#f97316", margin: 0, fontSize: "24px" }}>Bill Management</h2>

        <button
          type="button"
          onClick={() => navigate("/admin/bill/add-bill")}
          style={primaryButtonStyle}
        >
          + Create New Bill
        </button>
      </div>

      {stats.error && (
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
          {stats.error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "26px",
        }}
      >
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <ActionCard
          title="📄 Manage Bills"
          description="Search, filter, edit, or delete existing bills."
          onClick={() => navigate("/admin/bill/products")}
        />
        <ActionCard
          title="🧾 Create New Bill"
          description="Bill a customer for a new jewelry purchase."
          onClick={() => navigate("/admin/bill/add-bill")}
        />
      </div>

      <style>{`
        @media (max-width: 700px) {
          div[style*="grid-template-columns: repeat(3, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div
    style={{
      padding: "20px",
      background: "#111113",
      border: "1px solid #27272a",
      borderRadius: "10px",
    }}
  >
    <div style={{ color: "#a1a1aa", fontSize: "12.5px", marginBottom: "8px" }}>{label}</div>
    <div style={{ color, fontSize: "26px", fontWeight: "700" }}>{value}</div>
  </div>
);

const ActionCard = ({ title, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      textAlign: "left",
      padding: "22px",
      background: "#18181b",
      border: "1px solid #27272a",
      borderRadius: "10px",
      cursor: "pointer",
      color: "#fff",
    }}
  >
    <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}>{title}</div>
    <div style={{ color: "#71717a", fontSize: "13px" }}>{description}</div>
  </button>
);

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

export default AdminBillDashboard;