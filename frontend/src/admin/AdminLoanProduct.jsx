import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const AdminLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const [loans, setLoans] = useState([]);

  useEffect(() => {
    const fetchLoans = async () => {
      const res = await fetch('/api/loans');
      const data = await res.json();
      setLoans(Array.isArray(data) ? data : []);
    };
    fetchLoans();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you strictly sure you want to delete this?')) {
      const res = await fetch(`/api/loans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (res.ok) {
        setLoans(loans.filter(l => l._id !== id));
      }
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#f97316' }}>Manage Loans</h2>
        <Link to="/admin/add-loan" className="btn">+ Add Loan</Link>
      </div>

      {loans.length === 0 ? (
        <p style={{ color: '#a1a1aa' }}>No loans found.</p>
      ) : (
        <div style={gridStyle}>
          {loans.map(loan => {
            const available = (loan.available ?? 'yes').toString();
            const roi = loan.roi ?? 5;
            const signed = (loan.signed ?? 'no').toString();

            return (
              <div key={loan._id} style={cardStyle}>

                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{loan.name}</h3>
                    <p style={{ margin: '4px 0 0', color: '#a1a1aa', fontSize: '0.85rem' }}>ID: {loan.customerId}</p>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: available.toLowerCase() === 'yes' ? '#10b981' : '#ef4444',
                    border: `1px solid ${available.toLowerCase() === 'yes' ? '#10b981' : '#ef4444'}`
                  }}>
                    ● {available.toLowerCase() === 'yes' ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                {/* Contact */}
                <p style={labelStyle}>Address</p>
                <p style={valueStyle}>{loan.address}</p>

                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                  <div>
                    <p style={labelStyle}>Mobile No.</p>
                    <p style={valueStyle}>{loan.mobileNo}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>ROI</p>
                    <p style={{ ...valueStyle, color: '#f97316', fontWeight: 600 }}>{roi}%</p>
                  </div>
                </div>

                {/* Description */}
                <p style={labelStyle}>Description</p>
                <p style={{ ...valueStyle, lineHeight: '1.6' }}>{loan.description}</p>

                {/* Dates */}
                <div style={rowGrid}>
                  <div>
                    <p style={labelStyle}>Date</p>
                    <p style={valueStyle}>{formatDate(loan.date)}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Due Date</p>
                    <p style={valueStyle}>{formatDate(loan.dueDate)}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Dissolve Date</p>
                    <p style={valueStyle}>{formatDate(loan.dissolveDate)}</p>
                  </div>
                </div>

                {/* Amounts */}
                <div style={amountBox}>
                  <div>
                    <p style={labelStyle}>Loan Amount</p>
                    <p style={amountValue}>₹{Number(loan.loanAmount || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Interest</p>
                    <p style={amountValue}>₹{Number(loan.interest || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={labelStyle}>Total Amount</p>
                    <p style={{ ...amountValue, color: '#f97316', fontSize: '1.3rem' }}>
                      ₹{Number(loan.totalAmount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Signed */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>Signed:</span>
                  <span style={{ color: signed.toLowerCase() === 'yes' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>
                    {signed.toLowerCase() === 'yes' ? '● Yes' : '● No'}
                  </span>
                </div>

                {/* Final Settlement */}
                <p style={labelStyle}>Final Settlement</p>
                <p style={{ ...valueStyle, lineHeight: '1.6' }}>{loan.finalSettlement || '—'}</p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <Link to={`/admin/loan/edit-loan/${loan._id}`} style={editBtn}>Edit</Link>
                  <button onClick={() => handleDelete(loan._id)} style={deleteBtn}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const containerStyle = { maxWidth: '1300px', margin: '40px auto', padding: '30px', color: '#fafafa' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' };
const cardStyle = { background: '#18181b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' };
const labelStyle = { color: '#a1a1aa', fontSize: '0.8rem', margin: '10px 0 2px', textTransform: 'uppercase', letterSpacing: '0.03em' };
const valueStyle = { color: '#fafafa', fontSize: '0.95rem', margin: 0 };
const rowGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' };
const amountBox = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#111113', borderRadius: '8px', padding: '12px', marginTop: '12px' };
const amountValue = { color: '#fafafa', fontSize: '1.05rem', fontWeight: 700, margin: 0 };
const editBtn = { background: '#3b82f6', color: '#fff', padding: '8px 14px', borderRadius: '4px', fontSize: '0.9rem', textDecoration: 'none' };
const deleteBtn = { background: '#ef4444', color: '#fff', padding: '8px 14px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' };

export default AdminLoanProduct;