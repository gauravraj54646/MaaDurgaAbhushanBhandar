import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";

// ------------------------------------------------------------
// Edit these to match your real shop. Nothing else needs changing.
// ------------------------------------------------------------
const SHOP_NAME = "Maa Durga Abhushan Bhandar";
const SHOP_NAME_HINDI = "माँ दुर्गा आभूषण भंडार";

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

// ------------------------------------------------------------
// Mahal (palace) silhouette: domes, chhatris, kanguras & glowing arches
// ------------------------------------------------------------
const BODY = "#240610";
const GOLD = "#c9a24b";
const GLOW = "#e6c675";

const arch = (x, w, top, bottom) =>
  `M${x} ${bottom} V${top + w * 0.5} Q${x + w / 2} ${top - w * 0.2} ${x + w} ${
    top + w * 0.5
  } V${bottom} Z`;

const Palace = ({ className }) => {
  const kanguras = (from, to) => {
    const items = [];
    for (let x = from; x < to; x += 22) {
      items.push(`M${x} 140 l11 -14 l11 14 z`);
    }
    return items.join(" ");
  };
  const wingWindows = (from, count) =>
    Array.from({ length: count }, (_, i) => from + i * 40);

  return (
    <svg
      className={className}
      viewBox="0 0 1200 240"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <g fill={BODY} stroke={GOLD} strokeOpacity="0.55" strokeWidth="1">
        {/* ground */}
        <rect x="0" y="206" width="1200" height="34" />

        {/* wings */}
        <rect x="120" y="140" width="350" height="68" />
        <rect x="730" y="140" width="350" height="68" />
        <path d={kanguras(120, 470)} />
        <path d={kanguras(730, 1080)} />

        {/* wing chhatris */}
        <rect x="272" y="108" width="36" height="32" />
        <path d="M264 108 Q290 70 316 108 Z" />
        <rect x="892" y="108" width="36" height="32" />
        <path d="M884 108 Q910 70 936 108 Z" />

        {/* end towers */}
        <rect x="68" y="118" width="72" height="90" />
        <path d="M60 118 Q104 52 148 118 Z" />
        <rect x="1060" y="118" width="72" height="90" />
        <path d="M1052 118 Q1096 52 1140 118 Z" />

        {/* central mahal */}
        <rect x="470" y="108" width="260" height="100" />
        <rect x="540" y="86" width="120" height="24" />
        <path d="M530 86 Q600 -8 670 86 Z" />
        <line x1="600" y1="40" x2="600" y2="14" />
        <circle cx="600" cy="12" r="4" />
      </g>

      {/* finials on towers */}
      <g stroke={GOLD} strokeOpacity="0.7" strokeWidth="1.2">
        <line x1="104" y1="76" x2="104" y2="58" />
        <line x1="1096" y1="76" x2="1096" y2="58" />
        <line x1="290" y1="84" x2="290" y2="70" />
        <line x1="910" y1="84" x2="910" y2="70" />
      </g>

      {/* glowing jharokha arches */}
      <g fill={GLOW} fillOpacity="0.6">
        <path d={arch(90, 30, 150, 190)} />
        <path d={arch(1080, 30, 150, 190)} />
        {[500, 580, 660].map((x) => (
          <path key={x} d={arch(x, 40, 140, 200)} />
        ))}
        {wingWindows(150, 7).map((x) => (
          <path key={`l${x}`} d={arch(x, 22, 164, 198)} />
        ))}
        {wingWindows(760, 7).map((x) => (
          <path key={`r${x}`} d={arch(x, 22, 164, 198)} />
        ))}
        <path d={arch(584, 32, 92, 108)} />
      </g>
    </svg>
  );
};

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
      {/* ================= HERO (Mahal at night) ================= */}
      <section className="hm-hero">
        <div className="hm-moon" aria-hidden="true" />
        <div className="hm-hero-inner">
          <span className="hm-eyebrow">Fine Jewellery</span>

          <h1 className="hm-title">{SHOP_NAME}</h1>
          <div className="hm-title-hindi">{SHOP_NAME_HINDI}</div>

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

        <Palace className="hm-palace" />
      </section>
      <div className="hm-frieze" aria-hidden="true" />

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

      {/* ================= CATEGORIES (jharokha arches) ================= */}
      <section className="hm-section hm-section-jaali">
        <div className="hm-container">
          <SectionHeading small="Browse" title="Shop by Category" />

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
      <section id="featured" className="hm-section hm-section-maroon">
        <div className="hm-container">
          <SectionHeading
            small="Handpicked for you"
            title="Explore Our Collections"
            dark
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
                <Link to="/shop" className="hm-btn hm-btn-gold">
                  View All Jewellery
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ================= CLOSING BAND (Mahal again) ================= */}
      <div className="hm-frieze" aria-hidden="true" />
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
        <Palace className="hm-palace hm-palace-band" />
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Yatra+One&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600&display=swap');

        /* ---------- Remove side space (applies only while Home is open) ---------- */
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        #root {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          text-align: initial !important;
        }

        .hm-page {
          --maroon-950: #2a0610;
          --maroon-900: #3d0a14;
          --maroon-800: #5a0f1f;
          --maroon-700: #7b1428;
          --gold-500: #c9a24b;
          --gold-300: #e6c675;
          --cream: #fbf4e8;
          --cream-dark: #f3e8d2;
          --ink: #2b1a1d;

          /* Rajasthani motifs as tiny inline SVGs */
          --frieze: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='14' viewBox='0 0 28 14'%3E%3Cpath d='M14 1 L21 7 L14 13 L7 7 Z' fill='none' stroke='%23c9a24b' stroke-width='1.2'/%3E%3Ccircle cx='0' cy='7' r='1.6' fill='%23c9a24b'/%3E%3Ccircle cx='28' cy='7' r='1.6' fill='%23c9a24b'/%3E%3C/svg%3E");
          --jaali-gold: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='%23c9a24b' stroke-opacity='.2' stroke-width='1'%3E%3Cpath d='M30 4 L56 30 L30 56 L4 30 Z'/%3E%3Ccircle cx='30' cy='30' r='8'/%3E%3C/g%3E%3C/svg%3E");
          --jaali-maroon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='%237b1428' stroke-opacity='.12' stroke-width='1'%3E%3Cpath d='M30 4 L56 30 L30 56 L4 30 Z'/%3E%3Ccircle cx='30' cy='30' r='8'/%3E%3C/g%3E%3C/svg%3E");

          font-family: 'Jost', system-ui, sans-serif;
          color: var(--ink);
          background: var(--cream);
          box-sizing: border-box;

          /* Full-bleed: reach both screen edges even inside a narrow parent */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          overflow-x: hidden;
        }

        .hm-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          box-sizing: border-box;
          position: relative;
          z-index: 2;
        }

        /* Gold diamond border strip, used between big sections */
        .hm-frieze {
          height: 14px;
          background-color: var(--maroon-950);
          background-image: var(--frieze);
          background-repeat: repeat-x;
          background-position: center;
          border-top: 2px solid var(--gold-500);
          border-bottom: 2px solid var(--gold-500);
          box-sizing: content-box;
        }

        /* ---------- Hero ---------- */
        .hm-hero {
          position: relative;
          overflow: hidden;
          text-align: center;
          color: #fff;
          padding: 80px 20px 270px;
          background:
            var(--jaali-gold),
            radial-gradient(ellipse at 50% 100%, rgba(201,162,75,0.35), transparent 55%),
            linear-gradient(180deg, #1c040b 0%, var(--maroon-900) 40%, var(--maroon-700) 100%);
        }

        .hm-moon {
          position: absolute;
          top: 36px;
          right: 12%;
          width: 78px;
          height: 78px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #fff4d2, var(--gold-300) 60%, var(--gold-500));
          box-shadow: 0 0 40px 12px rgba(230,198,117,0.35);
          opacity: 0.9;
        }

        .hm-hero-inner {
          position: relative;
          z-index: 2;
          max-width: 780px;
          margin: 0 auto;
        }

        .hm-eyebrow {
          display: inline-block;
          font-size: 13px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--gold-300);
          margin-bottom: 16px;
        }

        .hm-title {
          margin: 0;
          font-family: 'Yatra One', Georgia, serif;
          font-weight: 400;
          font-size: 56px;
          line-height: 1.12;
          color: var(--gold-300);
          text-shadow: 0 2px 0 rgba(0,0,0,0.35), 0 0 28px rgba(201,162,75,0.35);
        }

        .hm-title-hindi {
          margin-top: 8px;
          font-family: 'Yatra One', serif;
          font-size: 24px;
          color: #f6e9cf;
          opacity: 0.9;
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
          width: 80px;
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
          font-style: italic;
          font-size: 25px;
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

        .hm-palace {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 240px;
          z-index: 1;
          display: block;
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
        .hm-btn:focus-visible { outline: 2px solid var(--gold-300); outline-offset: 3px; }

        .hm-btn-gold {
          background: linear-gradient(135deg, var(--gold-300), var(--gold-500));
          color: var(--maroon-900);
          border: 1px solid #f3dc9b;
        }
        .hm-btn-outline {
          border: 1px solid var(--gold-300);
          color: var(--gold-300);
          background: rgba(42,6,16,0.55);
        }
        .hm-btn-outline:hover { background: rgba(230,198,117,0.18); }

        /* ---------- Trust strip ---------- */
        .hm-trust {
          background: var(--maroon-950);
          background-image: var(--jaali-gold);
          border-bottom: 2px solid var(--gold-500);
        }
        .hm-trust-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .hm-trust-item {
          text-align: center;
          padding: 26px 14px;
          border-right: 1px solid rgba(201,162,75,0.35);
        }
        .hm-trust-item:last-child { border-right: none; }
        .hm-trust-title {
          font-family: 'Yatra One', Georgia, serif;
          font-size: 19px;
          color: var(--gold-300);
        }
        .hm-trust-text {
          margin-top: 5px;
          font-size: 13px;
          color: #e9d9bb;
        }

        /* ---------- Sections ---------- */
        .hm-section { padding: 70px 0; position: relative; }
        .hm-section-jaali {
          background-color: var(--cream);
          background-image: var(--jaali-maroon);
        }
        .hm-section-maroon {
          background:
            var(--jaali-gold),
            linear-gradient(180deg, var(--maroon-800), var(--maroon-900));
        }

        .hm-heading { text-align: center; margin-bottom: 42px; }
        .hm-heading-small {
          display: block;
          font-size: 12.5px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--gold-500);
          margin-bottom: 8px;
        }
        .hm-heading-title {
          margin: 0;
          font-family: 'Yatra One', Georgia, serif;
          font-size: 38px;
          font-weight: 400;
          color: var(--maroon-800);
        }
        .hm-heading-dark .hm-heading-title { color: var(--gold-300); }
        .hm-heading .hm-divider { margin: 14px auto 0; }
        .hm-heading .hm-divider span { width: 56px; background: linear-gradient(90deg, transparent, var(--gold-500)); }
        .hm-heading .hm-divider span:last-child { background: linear-gradient(270deg, transparent, var(--gold-500)); }
        .hm-heading .hm-divider i { background: var(--gold-500); width: 8px; height: 8px; }

        /* ---------- Categories: jharokha arch windows ---------- */
        .hm-cat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .hm-cat {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          text-align: center;
          min-height: 320px;
          padding: 24px 18px 28px;
          border-radius: 999px 999px 6px 6px;
          text-decoration: none;
          color: #fff;
          overflow: hidden;
          border: 2px solid var(--gold-500);
          box-shadow: 0 0 0 4px var(--cream), 0 0 0 5px rgba(201,162,75,0.7);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hm-cat::before {
          content: "";
          position: absolute;
          inset: 8px;
          border: 1px solid rgba(255,255,255,0.45);
          border-radius: 999px 999px 3px 3px;
          pointer-events: none;
        }
        .hm-cat:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 0 4px var(--cream), 0 0 0 5px var(--gold-500), 0 16px 28px rgba(61,10,20,0.28);
        }
        .hm-cat:focus-visible { outline: 3px solid var(--maroon-700); outline-offset: 6px; }

        .hm-cat-gold    { background: linear-gradient(170deg, #8a6a1f, #c9a24b 55%, #e6c675); color: #3d0a14; }
        .hm-cat-silver  { background: linear-gradient(170deg, #4b4f57, #8b919c 55%, #c9ced6); color: #1d1f23; }
        .hm-cat-diamond { background: linear-gradient(170deg, #1f3550, #3b6a99 55%, #9cc3e6); }
        .hm-cat-bridal  { background: linear-gradient(170deg, var(--maroon-950), var(--maroon-700) 55%, #b0384d); }

        .hm-cat-name {
          font-family: 'Yatra One', Georgia, serif;
          font-size: 30px;
          line-height: 1.1;
        }
        .hm-cat-note { margin-top: 4px; font-size: 13.5px; opacity: 0.92; }
        .hm-cat-link {
          margin-top: 14px;
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-weight: 600;
          padding-bottom: 3px;
          border-bottom: 1px solid currentColor;
        }

        /* ---------- Product grid ---------- */
        .hm-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 24px;
        }
        .hm-grid > * { min-width: 0; }

        .hm-card {
          background: #fff;
          border: 1px solid var(--gold-500);
          border-top: 4px solid var(--gold-500);
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 0 0 3px var(--maroon-900), 0 0 0 4px rgba(201,162,75,0.7), 0 8px 18px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hm-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 0 0 3px var(--maroon-900), 0 0 0 4px var(--gold-300), 0 16px 30px rgba(0,0,0,0.4);
        }
        .hm-card img { max-width: 100%; height: auto; }

        .hm-skeleton {
          height: 320px;
          border-radius: 4px;
          background: linear-gradient(90deg, #6b1626 25%, #84202f 50%, #6b1626 75%);
          background-size: 200% 100%;
          animation: hm-shimmer 1.3s infinite;
        }
        @keyframes hm-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hm-skeleton { animation: none; }
          .hm-btn, .hm-cat, .hm-card { transition: none; }
        }

        .hm-status {
          text-align: center;
          padding: 36px 0;
          color: #f1e3c8;
          font-size: 16px;
        }

        .hm-more { text-align: center; margin-top: 40px; }

        /* ---------- Closing band ---------- */
        .hm-band {
          position: relative;
          overflow: hidden;
          text-align: center;
          color: #fff;
          padding: 70px 0 250px;
          background:
            var(--jaali-gold),
            radial-gradient(ellipse at 50% 100%, rgba(201,162,75,0.3), transparent 55%),
            linear-gradient(180deg, var(--maroon-900), var(--maroon-950));
        }
        .hm-band-inner { max-width: 680px; }
        .hm-band-title {
          margin: 0 0 12px;
          font-family: 'Yatra One', Georgia, serif;
          font-size: 36px;
          font-weight: 400;
          color: var(--gold-300);
        }
        .hm-band-text {
          margin: 0 0 26px;
          font-size: 16px;
          line-height: 1.65;
          color: #f1e3c8;
        }

        /* ---------- Tablet ---------- */
        @media (max-width: 900px) {
          .hm-title { font-size: 42px; }
          .hm-moon { width: 56px; height: 56px; right: 8%; top: 24px; }
          .hm-cat-grid { grid-template-columns: repeat(2, 1fr); }
          .hm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
          .hm-trust-grid { grid-template-columns: repeat(2, 1fr); }
          .hm-trust-item:nth-child(2) { border-right: none; }
          .hm-trust-item:nth-child(-n+2) { border-bottom: 1px solid rgba(201,162,75,0.35); }
        }

        /* ---------- Phone ---------- */
        @media (max-width: 640px) {
          .hm-hero { padding: 60px 16px 190px; }
          .hm-palace { height: 170px; }
          .hm-moon { width: 40px; height: 40px; box-shadow: 0 0 24px 8px rgba(230,198,117,0.35); }
          .hm-eyebrow { font-size: 11px; letter-spacing: 0.26em; margin-bottom: 12px; }
          .hm-title { font-size: 30px; }
          .hm-title-hindi { font-size: 18px; }
          .hm-divider { margin: 16px auto; }
          .hm-divider span { width: 44px; }
          .hm-tagline { font-size: 19px; margin-bottom: 24px; }
          .hm-btn { padding: 12px 22px; font-size: 12.5px; }
          .hm-hero-actions { gap: 10px; }

          .hm-trust-item { padding: 16px 8px; }
          .hm-trust-title { font-size: 16px; }
          .hm-trust-text { font-size: 12px; }

          .hm-section { padding: 44px 0; }
          .hm-container { padding: 0 14px; }
          .hm-heading { margin-bottom: 26px; }
          .hm-heading-title { font-size: 27px; }

          .hm-cat-grid { gap: 14px; }
          .hm-cat { min-height: 210px; padding: 14px 10px 18px; }
          .hm-cat-name { font-size: 22px; }
          .hm-cat-note { font-size: 12px; }
          .hm-cat-link { margin-top: 8px; font-size: 11px; }

          .hm-grid { gap: 14px; }
          .hm-skeleton { height: 230px; }

          .hm-band { padding: 46px 0 190px; }
          .hm-band-title { font-size: 26px; }
          .hm-band-text { font-size: 14.5px; }
        }
      `}</style>
    </div>
  );
};

// Section title with a small gold ornament underneath
const SectionHeading = ({ small, title, dark = false }) => (
  <div className={`hm-heading${dark ? " hm-heading-dark" : ""}`}>
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