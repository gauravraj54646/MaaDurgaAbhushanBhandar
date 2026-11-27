import React from 'react';
import { Link } from 'react-router-dom';

// Optional contact details: leave empty to hide them
const SHOP_PHONE = '';
const SHOP_ADDRESS = '';

const Footer = () => {
  return (
    <footer className="ft">
      <div className="ft-inner">
        <div className="ft-brand">
          <h3 className="ft-name">Maa Durga Abhushan Bhandar</h3>
          <p className="ft-tag">Fine Jewellery · Tradition &amp; Elegance</p>

          {SHOP_ADDRESS && <p className="ft-contact">{SHOP_ADDRESS}</p>}
          {SHOP_PHONE && (
            <p className="ft-contact">
              <a href={`tel:${SHOP_PHONE.replace(/\s/g, '')}`}>{SHOP_PHONE}</a>
            </p>
          )}
        </div>

        <nav className="ft-links" aria-label="Footer">
          <Link to="/about">About Us</Link>
          <Link to="/return">Return Policy</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </nav>
      </div>

      <div className="ft-bottom">
        &copy; {new Date().getFullYear()} MDAB. All rights reserved.
      </div>

      <style>{`
        .ft {
          margin-top: auto;
          background: linear-gradient(135deg, #2a0710, #3d0a14 60%, #4a0c18);
          border-top: 3px solid #c9a24b;
          color: #f1e3c8;
          font-family: 'Jost', system-ui, sans-serif;
        }

        .ft-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px 28px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          box-sizing: border-box;
        }

        .ft-name {
          margin: 0 0 6px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: #e6c675;
        }

        .ft-tag {
          margin: 0;
          font-size: 14px;
          letter-spacing: 0.04em;
          color: #d9c8a6;
        }

        .ft-contact {
          margin: 10px 0 0;
          font-size: 14px;
          color: #d9c8a6;
        }

        .ft-contact a {
          color: #e6c675;
          text-decoration: none;
        }

        .ft-links {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
        }

        .ft-links a {
          color: #f1e3c8;
          font-size: 14px;
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: color 0.2s ease;
        }

        .ft-links a:hover {
          color: #e6c675;
        }

        .ft-bottom {
          border-top: 1px solid rgba(230, 198, 117, 0.25);
          text-align: center;
          padding: 16px 20px;
          font-size: 13px;
          color: #b9a784;
        }

        @media (max-width: 640px) {
          .ft-inner {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 30px 16px 20px;
            gap: 18px;
          }
          .ft-name { font-size: 24px; }
          .ft-links { justify-content: center; gap: 18px; }
        }
      `}</style>
    </footer>
  );
};

export default Footer;