import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Simple word-count helper (splits on whitespace, ignores empty tokens)
const wordCount = (str = '') => str.trim().split(/\s+/).filter(Boolean).length;

const AddLoanProduct = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    customerId: '',
    mobileNo: '',
    description: '',
    date: '',
    dueDate: '',
    available: 'yes',
    roi: 5,
    dissolveDate: '',
    loanAmount: '',
    interest: '',
    totalAmount: '',
    signed: 'no',
    finalSettlement: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (!user || user.role !== 'admin') {
    navigate('/');
    return null;
  }

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required.';
    if (wordCount(formData.name) > 60) errs.name = 'Name must be 60 words or fewer.';

    if (!formData.address.trim()) errs.address = 'Address is required.';
    if (wordCount(formData.address) > 100) errs.address = 'Address must be 100 words or fewer.';

    if (!/^[A-Za-z]{1,8}$/.test(formData.customerId)) {
      errs.customerId = 'Customer ID must be letters only, max 8 characters.';
    }

    if (!/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = 'Mobile No. must be exactly 10 digits.';
    }

    if (!formData.description.trim()) errs.description = 'Description is required.';
    if (wordCount(formData.description) > 300) errs.description = 'Description must be 300 words or fewer.';

    if (wordCount(formData.finalSettlement) > 100) {
      errs.finalSettlement = 'Final Settlement must be 100 words or fewer.';
    }

    if (!formData.date) errs.date = 'Date is required.';
    if (!formData.dueDate) errs.dueDate = 'Due Date is required.';

    if (formData.loanAmount === '' || Number(formData.loanAmount) < 0) errs.loanAmount = 'Enter a valid loan amount.';
    if (formData.interest === '' || Number(formData.interest) < 0) errs.interest = 'Enter a valid interest amount.';
    if (formData.totalAmount === '' || Number(formData.totalAmount) < 0) errs.totalAmount = 'Enter a valid total amount.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(formData)
      });
      const responseData = await res.json();

      if (res.ok) {
        alert('Loan created successfully!');
        navigate('/admin/loans');
      } else {
        alert(responseData.message || 'Error creating loan');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '650px', margin: '40px auto', background: '#18181b', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h2 style={{ color: '#f97316', marginBottom: '20px' }}>Add New Loan</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

        <div>
          <input type="text" placeholder="Name" required value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)} style={inputStyle} />
          <FieldError msg={errors.name} />
        </div>

        <div>
          <textarea placeholder="Address" required rows="2" value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)} style={inputStyle} />
          <FieldError msg={errors.address} />
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <input type="text" placeholder="Customer ID (max 8 letters)" required maxLength={8} value={formData.customerId}
              onChange={(e) => handleChange('customerId', e.target.value.replace(/[^A-Za-z]/g, ''))} style={inputStyle} />
            <FieldError msg={errors.customerId} />
          </div>
          <div style={{ flex: 1 }}>
            <input type="text" placeholder="Mobile No. (10 digits)" required maxLength={10} value={formData.mobileNo}
              onChange={(e) => handleChange('mobileNo', e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
            <FieldError msg={errors.mobileNo} />
          </div>
        </div>

        <div>
          <textarea placeholder="Description" required rows="4" value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)} style={inputStyle} />
          <FieldError msg={errors.description} />
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date</label>
            <input type="date" required value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)} style={inputStyle} />
            <FieldError msg={errors.date} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Due Date</label>
            <input type="date" required value={formData.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)} style={inputStyle} />
            <FieldError msg={errors.dueDate} />
          </div>
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Available</label>
            <select value={formData.available} onChange={(e) => handleChange('available', e.target.value)} style={inputStyle}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ROI (%)</label>
            <input type="number" step="0.01" value={formData.roi}
              onChange={(e) => handleChange('roi', e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Dissolve Date</label>
          <input type="date" value={formData.dissolveDate}
            onChange={(e) => handleChange('dissolveDate', e.target.value)} style={inputStyle} />
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <input type="number" placeholder="Loan Amount" required value={formData.loanAmount}
              onChange={(e) => handleChange('loanAmount', e.target.value)} style={inputStyle} />
            <FieldError msg={errors.loanAmount} />
          </div>
          <div style={{ flex: 1 }}>
            <input type="number" placeholder="Interest" required value={formData.interest}
              onChange={(e) => handleChange('interest', e.target.value)} style={inputStyle} />
            <FieldError msg={errors.interest} />
          </div>
        </div>

        <div>
          <input type="number" placeholder="Total Amount" required value={formData.totalAmount}
            onChange={(e) => handleChange('totalAmount', e.target.value)} style={inputStyle} />
          <FieldError msg={errors.totalAmount} />
        </div>

        <div>
          <label style={labelStyle}>Signed</label>
          <select value={formData.signed} onChange={(e) => handleChange('signed', e.target.value)} style={inputStyle}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div>
          <textarea placeholder="Final Settlement" rows="3" value={formData.finalSettlement}
            onChange={(e) => handleChange('finalSettlement', e.target.value)} style={inputStyle} />
          <FieldError msg={errors.finalSettlement} />
        </div>

        <button type="submit" disabled={loading} className="btn" style={{ marginTop: '10px' }}>
          {loading ? 'Creating...' : 'Publish Loan'}
        </button>
      </form>
    </div>
  );
};

const FieldError = ({ msg }) =>
  msg ? <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0' }}>{msg}</p> : null;

const inputStyle = {
  width: '100%',
  padding: '12px',
  background: '#09090b',
  border: '1px solid #27272a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '15px',
  outline: 'none',
  boxSizing: 'border-box'
};
const labelStyle = { display: 'block', marginBottom: '6px', color: '#a1a1aa', fontSize: '0.85rem' };
const rowStyle = { display: 'flex', gap: '15px' };

export default AddLoanProduct;