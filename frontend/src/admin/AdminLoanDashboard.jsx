import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLoanDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/loans/analytics', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setStats(data);
        } else {
          if (res.status === 401) {
            navigate('/login');
          }
          setStats({
            totalLoans: 0,
            availableLoans: 0,
            returnedLoans: 0,
            signedLoans: 0,
          });
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchStats();
  }, [user, navigate]);

  return (
    <div className="ald-wrap">
      <div className="ald-head">
        <img src="/ShopNestLogo.png" alt="Logo" className="ald-logo" />
        <h2 className="ald-title">Admin Loan Dashboard</h2>
      </div>
      <p className="ald-welcome">
        Welcome back, <span>{user?.name}</span>
      </p>

      {stats ? (
        <div className="ald-stats">
          <div className="ald-card">
            <h4>Total Loans</h4>
            <div className="ald-number">{stats.totalLoans}</div>
          </div>

          <div className="ald-card">
            <h4>Available Loans</h4>
            <div className="ald-number">{stats.availableLoans}</div>
          </div>

          <div className="ald-card">
            <h4>Returned Loans</h4>
            <div className="ald-number">{stats.returnedLoans}</div>
          </div>

          <div className="ald-card">
            <h4>Signed Loans</h4>
            <div className="ald-number">{stats.signedLoans}</div>
          </div>
        </div>
      ) : (
        <div className="ald-loading">Loading metrics...</div>
      )}

      <div className="ald-controls">
        <h3>Administrative Controls</h3>
        <div className="ald-buttons">
          <button className="btn" onClick={() => navigate('/admin/loan/add-loan')}>
            + Add Loan
          </button>
          <button
            className="btn"
            onClick={() => navigate('/admin/loan/products')}
            style={{ background: '#3f3f46' }}
          >
            📄 Manage Loans
          </button>
          <button
            className="btn"
            onClick={() => navigate('/admin/people')}
            style={{ background: '#3f3f46' }}
          >
            + Add People
          </button>
        </div>
      </div>

      <style>{`
        .ald-wrap { padding: 20px; max-width: 1000px; margin: 0 auto; box-sizing: border-box; }
        .ald-head { display: flex; align-items: center; gap: 15px; margin-bottom: 5px; }
        .ald-logo {
          height: 40px; width: 40px; border-radius: 8px; object-fit: cover;
          filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.3));
        }
        .ald-title { margin: 0; }
        .ald-welcome { color: #a1a1aa; margin: 0 0 30px; font-size: 1.1rem; }
        .ald-welcome span { color: #fff; }

        .ald-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .ald-card {
          padding: 25px;
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          min-width: 0;
        }
        .ald-card h4 { margin: 0; color: #a1a1aa; font-size: 1rem; }
        .ald-number { font-size: 2.5rem; font-weight: 700; color: #f97316; }

        .ald-loading { text-align: center; margin: 50px 0; color: #f97316; }

        .ald-controls {
          margin-top: 40px;
          padding: 30px;
          background: #18181b;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .ald-controls h3 { margin: 0 0 25px; color: #f97316; }
        .ald-buttons { display: flex; gap: 20px; flex-wrap: wrap; }

        @media (max-width: 640px) {
          .ald-wrap { padding: 12px 10px; }
          .ald-head { gap: 10px; }
          .ald-logo { height: 30px; width: 30px; border-radius: 6px; }
          .ald-title { font-size: 18px; }
          .ald-welcome { font-size: 13px; margin-bottom: 14px; }

          /* 2 x 2 grid of compact tiles */
          .ald-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .ald-card { padding: 12px 8px; gap: 4px; border-radius: 10px; }
          .ald-card h4 { font-size: 12px; }
          .ald-number { font-size: 1.7rem; }

          .ald-loading { margin: 30px 0; font-size: 14px; }

          .ald-controls { margin-top: 16px; padding: 12px; border-radius: 10px; }
          .ald-controls h3 { font-size: 15px; margin-bottom: 10px; }

          /* full-width stacked buttons, easy to tap */
          .ald-buttons { flex-direction: column; gap: 8px; }
          .ald-buttons .btn {
            width: 100%;
            padding: 11px 14px;
            font-size: 14px;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminLoanDashboard;