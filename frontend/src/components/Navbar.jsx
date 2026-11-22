import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSelector } from 'react-redux';
import '../styles/navbar.css';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const cartItems = useSelector((state) => state.cart.cartItems);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" onClick={closeMenu}>
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

      <button
        className="navbar-toggle"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
      { /* 
        <li><Link to="/shop" onClick={closeMenu}>Shop</Link></li>
        <li><Link to="/cart" onClick={closeMenu}>Cart ({cartItems.length})</Link></li>
      */}
        {user ? (
          <>
            <li><Link to="/profile" onClick={closeMenu}>Hi, {user.name}</Link></li>
            {user.role === 'admin' && (
              <>
                <li><Link to="/admin" onClick={closeMenu}>Admin</Link></li>
                <li><Link to="/admin/people" onClick={closeMenu}>People</Link></li>
                <li><Link to="/admin/vyapar" onClick={closeMenu}>Vyapar</Link></li>
                <li><Link to="/admin/bill" onClick={closeMenu}>Bill</Link></li>
                <li><Link to="/admin/loan" onClick={closeMenu}>Loan</Link></li>
              </>
            )}
            <li><button onClick={handleLogout} className="btn-logout">Logout</button></li>
          </>
        ) : (
          <li><Link to="/login" onClick={closeMenu}>Login</Link></li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;