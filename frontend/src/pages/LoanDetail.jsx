import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../styles/loan.css';

const LoanDetail = () => {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const res = await fetch(`/api/loans/${id}`);
        const data = await res.json();
        setLoan(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLoan();
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', margin: '100px', color: '#f97316' }}>Loading Loan...</div>;
  if (!loan) return <div style={{ textAlign: 'center', margin: '100px', color: '#ef4444' }}>Loan Not Found</div>;

  const {
    name = '',
    address = '',
    customerId = '',
    mobileNo = '',
    description = '',
    date = '',
    dueDate = '',
    available = 'yes',
    roi = 5,
    dissolveDate = '',
    loanAmount = 0,
    interest = 0,
    totalAmount = 0,
    signed = 'no',
    finalSettlement = ''
  } = loan;

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div className="loan-detail-wrapper" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

      {/* Breadcrumb Navigation */}
      <div style={{ color: '#a1a1aa', marginBottom: '20px', fontSize: '0.95rem' }}>
        <Link to="/" style={{ color: '#f97316' }}>Home</Link> / <Link to="/loans" style={{ color: '#f97316' }}>Loans</Link> / <span style={{ color: '#fff' }}>{name}</span>
      </div>

      <div className="loan-card" style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '12px',
        padding: '30px'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '2.2rem', margin: 0 }}>{name}</h2>
            <p style={{ color: '#a1a1aa', margin: '6px 0 0' }}>Customer ID: <span style={{ color: '#fff' }}>{customerId}</span></p>
          </div>
          <span style={{
            padding: '6px 14px',
            borderRadius: '999px',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: available.toLowerCase() === 'yes' ? '#10b981' : '#ef4444',
            border: `1px solid ${available.toLowerCase() === 'yes' ? '#10b981' : '#ef4444'}`
          }}>
            ● {available.toLowerCase() === 'yes' ? 'Available' : 'Not Available'}
          </span>
        </div>

        {/* Contact Info */}
        <div className="loan-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '25px',
          paddingBottom: '25px',
          borderBottom: '1px solid #27272a'
        }}>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px' }}>Address</h4>
            <p style={{ color: '#a1a1aa', lineHeight: '1.6' }}>{address}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px' }}>Mobile No.</h4>
            <p style={{ color: '#a1a1aa' }}>{mobileNo}</p>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#fff', marginBottom: '10px' }}>Description</h4>
          <p style={{ color: '#a1a1aa', lineHeight: '1.8' }}>{description}</p>
        </div>

        {/* Loan Terms */}
        <div className="loan-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '18px',
          marginBottom: '25px'
        }}>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Date</h4>
            <p style={{ color: '#a1a1aa' }}>{formatDate(date)}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Due Date</h4>
            <p style={{ color: '#a1a1aa' }}>{formatDate(dueDate)}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Dissolve Date</h4>
            <p style={{ color: '#a1a1aa' }}>{formatDate(dissolveDate)}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>ROI</h4>
            <p style={{ color: '#f97316', fontWeight: 600 }}>{roi}%</p>
          </div>
        </div>

        {/* Amounts */}
        <div className="loan-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '18px',
          marginBottom: '25px',
          padding: '20px',
          background: '#111113',
          borderRadius: '8px'
        }}>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Loan Amount</h4>
            <p style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700 }}>₹{Number(loanAmount).toFixed(2)}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Interest</h4>
            <p style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700 }}>₹{Number(interest).toFixed(2)}</p>
          </div>
          <div>
            <h4 style={{ color: '#fff', marginBottom: '6px', fontSize: '0.9rem' }}>Total Amount</h4>
            <p style={{ color: '#f97316', fontSize: '1.6rem', fontWeight: 700 }}>₹{Number(totalAmount).toFixed(2)}</p>
          </div>
        </div>

        {/* Signed & Final Settlement */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ color: '#fff', fontWeight: 600 }}>Signed:</span>
          <span style={{ color: signed.toLowerCase() === 'yes' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {signed.toLowerCase() === 'yes' ? '● Yes' : '● No'}
          </span>
        </div>

        <div>
          <h4 style={{ color: '#fff', marginBottom: '10px' }}>Final Settlement</h4>
          <p style={{ color: '#a1a1aa', lineHeight: '1.8' }}>{finalSettlement || '—'}</p>
        </div>

      </div>
    </div>
  );
};

export default LoanDetail;