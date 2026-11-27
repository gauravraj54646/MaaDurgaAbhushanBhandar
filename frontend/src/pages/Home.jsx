import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";

// ------------------------------------------------------------
// Edit these to match your real shop. Nothing else needs changing.
// ------------------------------------------------------------
const SHOP_NAME = "Maa Durga Abhushan Bhandar";

const TRUST_POINTS = [
  { title: "Pure Gold & Silver", text: "Honest purity, every piece" },
  { title: "Transparent Pricing", text: "Clear rate and making charges" },
  { title: "Exchange Available", text: "Old jewellery accepted" },
  { title: "Trusted Service", text: "Customers who return" },
];

const CATEGORIES = [
  { name: "Gold", note: "Timeless classics", tone: "gold" },
  { name: "Silver", note: "Pure and graceful", tone: "silver" },
  { name: "Diamond", note: "Everyday brilliance", tone: "diamond" },
  { name: "Bridal", note: "For your big day", tone: "bridal" },
];

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data.slice(0, 4) : []); // Featured products
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="hm-page">
      {/* ================= HERO ================= */}
      <section className="hm-hero">
        <div className="hm-hero-inner">
          <span className="hm-eyebrow">Fine Jewellery</span>

          <h1 className="hm-title">{SHOP_NAME}</h1>

          <div className="hm-divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>

          <p className="hm-tagline">
            Where Every Ornament Tells a Story of Love, Tradition &amp; Elegance.
          </p>

          <div className="hm-hero-actions">
            <Link to="/shop" className="hm-btn hm-btn-gold">
              Shop Now
            </Link>
            <a href="#featured" className="hm-btn hm-btn-outline">
              View Collection
            </a>
          </div>
        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}
      <section className="hm-trust">
        <div className="hm-container hm-trust-grid">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="hm-trust-item">
              <div className="hm-trust-title">{point.title}</div>
              <div className="hm-trust-text">{point.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="hm-section">
        <div className="hm-container">
          <SectionHeading
            small="Browse"
            title="Shop by Category"
          />

          <div className="hm-cat-grid">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to="/shop"
                className={`hm-cat hm-cat-${cat.tone}`}
              >
                <span className="hm-cat-name">{cat.name}</span>
                <span className="hm-cat-note">{cat.note}</span>
                <span className="hm-cat-link">Explore</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURED ================= */}
      <section id="featured" className="hm-section hm-section-cream">
        <div className="hm-container">
          <SectionHeading
            small="Handpicked for you"
            title="Explore Our Collections"
          />

          {loading ? (
            <div className="hm-grid">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="hm-skeleton" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="hm-status">
              New designs are on the way. Please visit us soon.
            </div>
          ) : (
            <>
              <div className="hm-grid">
                {products.map((product) => (
                  <div key={product._id} className="hm-card">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>

              <div className="hm-more">
                <Link to="/shop" className="hm-btn hm-btn-maroon">
                  View All Jewellery
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ================= CLOSING BAND ================= */}
      <section className="hm-band">
        <div className="hm-container hm-band-inner">
          <h2 className="hm-band-title">Jewellery for every celebration</h2>
          <p className="hm-band-text">
            From everyday wear to wedding collections, find the piece that
            becomes part of your family's story.
          </p>
          <Link to="/shop" className="hm-btn hm-btn-gold">
            Start Browsing
          </Link>
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600&display=swap');

        .hm-page {
          --maroon-900: #3d0a14;
          --maroon-800: #5a0f1f;
          --maroon-700: #7b1428;
          --gold-500: #c9a24b;
          --gold-300: #e6c675;
          --cream: #fbf4e8;
          --cream-dark: #f3e8d2;
          --ink: #2b1a1d;

          font-family: 'Jost', system-ui, sans-serif;
          color: var(--ink);
          width: 100%;
          overflow-x: hidden;
          background: var(--cream);
        }

        .hm-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          box-sizing: border-box;
        }

        /* ---------- Hero ---------- */
        .hm-hero {
          position: relative;
          text-align: center;
          color: #fff;
          padding: 90px 20px 100px;
          background:
            radial-gradient(circle at 20% 20%, rgba(201,162,75,0.18), transparent 45%),
            radial-gradient(circle at 80% 80%, rgba(201,162,75,0.12), transparent 40%),
            linear-gradient(135deg, var(--maroon-900), var(--maroon-700) 55%, var(--maroon-800));
          border-bottom: 3px solid var(--gold-500);
        }

        .hm-hero-inner { max-width: 760px; margin: 0 auto; }

        .hm-eyebrow {
          display: inline-block;
          font-size: 13px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: var(--gold-300);
          margin-bottom: 18px;
        }

        .hm-title {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 700;
          font-size: 54px;
          line-height: 1.1;
          color: #fff;
        }

        .hm-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin: 22px auto;
        }
        .hm-divider span {
          display: block;
          width: 70px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold-300));
        }
        .hm-divider span:last-child {
          background: linear-gradient(270deg, transparent, var(--gold-300));
        }
        .hm-divider i {
          width: 9px;
          height: 9px;
          background: var(--gold-300);
          transform: rotate(45deg);
        }

        .hm-tagline {
          margin: 0 auto 32px;
          max-width: 560px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 23px;
          font-weight: 500;
          line-height: 1.4;
          color: #f6e9cf;
        }

        .hm-hero-actions {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 14px;
        }

        /* ---------- Buttons ---------- */
        .hm-btn {
          display: inline-block;
          padding: 13px 30px;
          border-radius: 2px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .hm-btn:hover { transform: translateY(-2px); }

        .hm-btn-gold {
          background: linear-gradient(135deg, var(--gold-300), var(--gold-500));
          color: var(--maroon-900);
        }
        .hm-btn-outline {
          border: 1px solid var(--gold-300);
          color: var(--gold-300);
        }
        .hm-btn-outline:hover { background: rgba(230,198,117,0.12); }
        .hm-btn-maroon {
          background: var(--maroon-700);
          color: #fff;
        }
        .hm-btn-maroon:hover { background: var(--maroon-800); }

        /* ---------- Trust strip ---------- */
        .hm-trust {
          background: #fff;
          border-bottom: 1px solid var(--cream-dark);
        }
        .hm-trust-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .hm-trust-item {
          text-align: center;
          padding: 24px 14px;
          border-right: 1px solid var(--cream-dark);
        }
        .hm-trust-item:last-child { border-right: none; }
        .hm-trust-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 19px;
          font-weight: 700;
          color: var(--maroon-700);
        }
        .hm-trust-text {
          margin-top: 4px;
          font-size: 13px;
          color: #6b5a5d;
        }

        /* ---------- Sections ---------- */
        .hm-section { padding: 64px 0; }
        .hm-section-cream { background: var(--cream-dark); }

        .hm-heading { text-align: center; margin-bottom: 38px; }
        .hm-heading-small {
          display: block;
          font-size: 12.5px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--gold-500);
          margin-bottom: 8px;
        }
        .hm-heading-title {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 38px;
          font-weight: 700;
          color: var(--maroon-800);
        }
        .hm-heading .hm-divider { margin: 14px auto 0; }
        .hm-heading .hm-divider span { width: 50px; background: linear-gradient(90deg, transparent, var(--gold-500)); }
        .hm-heading .hm-divider span:last-child { background: linear-gradient(270deg, transparent, var(--gold-500)); }
        .hm-heading .hm-divider i { background: var(--gold-500); width: 7px; height: 7px; }

        /* ---------- Categories ---------- */
        .hm-cat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .hm-cat {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 220px;
          padding: 22px;
          border-radius: 4px;
          text-decoration: none;
          color: #fff;
          overflow: hidden;
          border: 1px solid rgba(201,162,75,0.5);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hm-cat:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 26px rgba(61,10,20,0.25);
        }
        .hm-cat-gold    { background: linear-gradient(160deg, #8a6a1f, #c9a24b 60%, #e6c675); color: #3d0a14; }
        .hm-cat-silver  { background: linear-gradient(160deg, #4b4f57, #8b919c 60%, #c9ced6); color: #1d1f23; }
        .hm-cat-diamond { background: linear-gradient(160deg, #1f3550, #3b6a99 60%, #9cc3e6); }
        .hm-cat-bridal  { background: linear-gradient(160deg, var(--maroon-900), var(--maroon-700) 60%, #b0384d); }

        .hm-cat-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px;
          font-weight: 700;
          line-height: 1.1;
        }
        .hm-cat-note { margin-top: 4px; font-size: 13.5px; opacity: 0.9; }
        .hm-cat-link {
          margin-top: 14px;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 600;
        }

        /* ---------- Product grid ---------- */
        .hm-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
        }
        .hm-grid > * { min-width: 0; }

        .hm-card {
          background: #fff;
          border: 1px solid rgba(201,162,75,0.35);
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(61,10,20,0.08);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hm-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 28px rgba(61,10,20,0.18);
        }
        .hm-card img { max-width: 100%; height: auto; }

        .hm-skeleton {
          height: 320px;
          border-radius: 4px;
          background: linear-gradient(90deg, #efe3cb 25%, #f8efdc 50%, #efe3cb 75%);
          background-size: 200% 100%;
          animation: hm-shimmer 1.3s infinite;
        }
        @keyframes hm-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .hm-status {
          text-align: center;
          padding: 36px 0;
          color: #6b5a5d;
          font-size: 16px;
        }

        .hm-more { text-align: center; margin-top: 36px; }

        /* ---------- Closing band ---------- */
        .hm-band {
          text-align: center;
          color: #fff;
          padding: 70px 0;
          background:
            radial-gradient(circle at 50% 0%, rgba(201,162,75,0.2), transparent 55%),
            linear-gradient(135deg, var(--maroon-900), var(--maroon-700));
          border-top: 3px solid var(--gold-500);
        }
        .hm-band-inner { max-width: 680px; }
        .hm-band-title {
          margin: 0 0 12px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 36px;
          font-weight: 700;
          color: var(--gold-300);
        }
        .hm-band-text {
          margin: 0 0 26px;
          font-size: 16px;
          line-height: 1.6;
          color: #f1e3c8;
        }

        /* ---------- Tablet ---------- */
        @media (max-width: 900px) {
          .hm-title { font-size: 42px; }
          .hm-cat-grid { grid-template-columns: repeat(2, 1fr); }
          .hm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .hm-trust-grid { grid-template-columns: repeat(2, 1fr); }
          .hm-trust-item:nth-child(2) { border-right: none; }
          .hm-trust-item:nth-child(-n+2) { border-bottom: 1px solid var(--cream-dark); }
        }

        /* ---------- Phone ---------- */
        @media (max-width: 640px) {
          .hm-hero { padding: 54px 16px 60px; }
          .hm-eyebrow { font-size: 11px; letter-spacing: 0.28em; margin-bottom: 12px; }
          .hm-title { font-size: 30px; }
          .hm-divider { margin: 16px auto; }
          .hm-divider span { width: 44px; }
          .hm-tagline { font-size: 18px; margin-bottom: 24px; }
          .hm-btn { padding: 12px 22px; font-size: 12.5px; }
          .hm-hero-actions { gap: 10px; }

          .hm-trust-item { padding: 16px 8px; }
          .hm-trust-title { font-size: 16px; }
          .hm-trust-text { font-size: 12px; }

          .hm-section { padding: 40px 0; }
          .hm-container { padding: 0 12px; }
          .hm-heading { margin-bottom: 24px; }
          .hm-heading-title { font-size: 27px; }

          .hm-cat-grid { gap: 10px; }
          .hm-cat { min-height: 150px; padding: 14px; }
          .hm-cat-name { font-size: 22px; }
          .hm-cat-note { font-size: 12px; }
          .hm-cat-link { margin-top: 8px; font-size: 11px; }

          .hm-grid { gap: 10px; }
          .hm-skeleton { height: 230px; }

          .hm-band { padding: 46px 0; }
          .hm-band-title { font-size: 26px; }
          .hm-band-text { font-size: 14.5px; }
        }
      `}</style>
    </div>
  );
};

// Section title with a small gold ornament underneath
const SectionHeading = ({ small, title }) => (
  <div className="hm-heading">
    <span className="hm-heading-small">{small}</span>
    <h2 className="hm-heading-title">{title}</h2>
    <div className="hm-divider" aria-hidden="true">
      <span />
      <i />
      <span />
    </div>
  </div>
);

export default Home;