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

  const cardStyle = {
    padding: '25px',
    background: '#18181b',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '10px'
  };

  const numberStyle = {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#f97316'
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px' }}>
        <img src="/ShopNestLogo.png" alt="Logo" style={{ height: '40px', width: '40px', borderRadius: '8px', objectFit: 'cover', filter: 'drop-shadow(0 0px 10px rgba(249, 115, 22, 0.3))' }} />
        <h2 style={{ margin: 0 }}>Admin Loan Dashboard</h2>
      </div>
      <p style={{ color: '#a1a1aa', marginBottom: '30px', fontSize: '1.1rem' }}>Welcome back, <span style={{color: '#fff'}}>{user?.name}</span></p>

      {stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div style={cardStyle}>
            <h4 style={{ color: '#a1a1aa', fontSize: '1rem' }}>Total Loans</h4>
            <div style={numberStyle}>{stats.totalLoans}</div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ color: '#a1a1aa', fontSize: '1rem' }}>Available Loans</h4>
            <div style={numberStyle}>{stats.availableLoans}</div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ color: '#a1a1aa', fontSize: '1rem' }}>Returned Loans</h4>
            <div style={numberStyle}>{stats.returnedLoans}</div>
          </div>

          <div style={cardStyle}>
            <h4 style={{ color: '#a1a1aa', fontSize: '1rem' }}>Signed Loans</h4>
            <div style={numberStyle}>{stats.signedLoans}</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', margin: '50px 0', color: '#f97316' }}>Loading metrics...</div>
      )}

      <div style={{ marginTop: '40px', padding: '30px', background: '#18181b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ marginBottom: '25px', color: '#f97316' }}>Administrative Controls</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/admin/loan/add-loan')}>+ Add Loan</button>
          <button className="btn" onClick={() => navigate('/admin/loan/products')} style={{ background: '#3f3f46' }}>📄 Manage Loans</button>
          <button className="btn" onClick={() => navigate('/admin/people')} style={{ background: '#3f3f46' }}>+ Add People</button>
        </div>
      </div>
    </div>
  );
};

export default AdminLoanDashboard;