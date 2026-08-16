import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';

// Simple word-count helper (splits on whitespace, ignores empty tokens)
const wordCount = (str = '') => str.trim().split(/\s+/).filter(Boolean).length;

const EditLoanProduct = () => {
  const { id } = useParams();
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
    returnDate: '',
    dissolveDate: '',
    loanAmount: '',
    interest: '',
    totalAmount: '',
    signed: 'no',
    finalSettlement: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Password confirmation modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const fetchLoan = async () => {
      const res = await fetch(`/api/loans/${id}`);
      const data = await res.json();
      setFormData({
        name: data.name || '',
        address: data.address || '',
        customerId: data.customerId || '',
        mobileNo: data.mobileNo || '',
        description: data.description || '',
        date: data.date ? data.date.substring(0, 10) : '',
        dueDate: data.dueDate ? data.dueDate.substring(0, 10) : '',
        available: data.available || 'yes',
        roi: data.roi ?? 5,        
        returnDate: data.returnDate ? data.returnDate.substring(0, 10) : '',
        dissolveDate: data.dissolveDate ? data.dissolveDate.substring(0, 10) : '',
        loanAmount: data.loanAmount ?? '',
        interest: data.interest ?? '',
        totalAmount: data.totalAmount ?? '',
        signed: data.signed || 'no',
        finalSettlement: data.finalSettlement || ''
      });
    };
    fetchLoan();
  }, [id]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // Validate all fields before allowing the password step to open
  const validate = () => {
    const errs = {};
    if (wordCount(formData.name) > 60) errs.name = 'Name must be 60 words or fewer.';
    if (!formData.name.trim()) errs.name = 'Name is required.';

    if (wordCount(formData.address) > 100) errs.address = 'Address must be 100 words or fewer.';
    if (!formData.address.trim()) errs.address = 'Address is required.';

    if (!/^[A-Za-z]{1,8}$/.test(formData.customerId)) {
      errs.customerId = 'Customer ID must be letters only, max 8 characters.';
    }

    if (!/^\d{10}$/.test(formData.mobileNo)) {
      errs.mobileNo = 'Mobile No. must be exactly 10 digits.';
    }

    if (wordCount(formData.description) > 300) errs.description = 'Description must be 300 words or fewer.';
    if (!formData.description.trim()) errs.description = 'Description is required.';

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

  // Step 1: validate fields, then open the password confirmation modal
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setPasswordError('');
    setPassword('');
    setShowPasswordModal(true);
  };

  // Step 2: verify admin password, then actually save the loan
  const handleConfirmPassword = async () => {
    if (!password) {
      setPasswordError('Password is required.');
      return;
    }
    setVerifying(true);
    setPasswordError('');
    try {
      const verifyRes = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ password })
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.valid) {
        setPasswordError('Incorrect password. Please try again.');
        setVerifying(false);
        return;
      }

      // Password confirmed — proceed with the actual update
      setLoading(true);
      const res = await fetch(`/api/loans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert('Loan updated successfully!');
        navigate('/admin/loans');
      } else {
        alert('Failed to update loan. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setPasswordError('Something went wrong verifying your password.');
    } finally {
      setVerifying(false);
      setLoading(false);
      setShowPasswordModal(false);
    }
  };

  return (
    <div style={{ maxWidth: '650px', margin: '40px auto', background: '#18181b', padding: '40px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <h2 style={{ color: '#f97316', marginBottom: '20px' }}>Edit Loan</h2>

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
          <label style={labelStyle}>Return Date</label>
          <input type="date" value={formData.returnDate}
            onChange={(e) => handleChange('returnDate', e.target.value)} style={inputStyle} />
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
          {loading ? 'Updating...' : 'Update Loan'}
        </button>
      </form>

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ color: '#f97316', marginBottom: '10px' }}>Confirm Admin Password</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginBottom: '15px' }}>
              Enter your admin password to save changes to this loan.
            </p>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmPassword()}
            />
            <FieldError msg={passwordError} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                disabled={verifying}
                style={cancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPassword}
                disabled={verifying}
                className="btn"
                style={{ flex: 1 }}
              >
                {verifying ? 'Verifying...' : 'Confirm & Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FieldError = ({ msg }) =>
  msg ? <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0' }}>{msg}</p> : null;

const inputStyle = { width: '100%', padding: '12px', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', marginBottom: '6px', color: '#a1a1aa', fontSize: '0.85rem' };
const rowStyle = { display: 'flex', gap: '15px' };

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalStyle = {
  background: '#18181b', border: '1px solid #27272a', borderRadius: '12px',
  padding: '30px', width: '90%', maxWidth: '380px'
};
const cancelBtn = {
  flex: '0 0 auto', padding: '10px 16px', background: 'transparent',
  border: '1px solid #27272a', borderRadius: '6px', color: '#a1a1aa', cursor: 'pointer'
};

export default EditLoanProduct;