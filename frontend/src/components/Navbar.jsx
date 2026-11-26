import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSelector } from 'react-redux';
import '../styles/navbar.css';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems);
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <img
            src="/ShopNestLogo.png"
            alt="Maa Durga Abhushan Bhandar"
            style={{
              height: '36px',
              width: '36px',
              borderRadius: '8px',
              objectFit: 'cover',
              filter: 'drop-shadow(0 2px 8px rgba(249, 115, 22, 0.35))',
            }}
          />
          <span>Maa Durga Abhushan Bhandar</span>
        </Link>
      </div>

      <ul className="navbar-links">
        {/*
        <li><Link to="/shop">Shop</Link></li>
        <li><Link to="/cart">Cart ({cartItems.length})</Link></li>
        */}
        {user ? (
          <>
            <li><Link to="/profile">Hi, {user.name}</Link></li>
            {user.role === 'admin' && (
              <>
                <li><Link to="/admin">Admin</Link></li>
                <li><Link to="/admin/people">People</Link></li>
                <li><Link to="/admin/vyapar">Vyapar</Link></li>
                <li><Link to="/admin/bill">Bill</Link></li>
                <li><Link to="/admin/loan">Loan</Link></li>
              </>
            )}
            <li className="navbar-logout-item">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="btn-logout"
              >
                Logout
              </button>
            </li>
          </>
        ) : (
          <li><Link to="/login">Login</Link></li>
        )}
      </ul>

      {showLogoutConfirm && (
        <div
          className="logout-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="logout-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Logout?</h3>
            <p>Are you sure you want to logout?</p>
            <div className="logout-dialog-actions">
              <button
                type="button"
                className="logout-cancel"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-confirm"
                onClick={handleLogout}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;