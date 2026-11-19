import React, { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(data.slice(0, 4)); // Featured products
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="home-container home-page">
      <section className="home-hero">
        <h1>Welcome to Maa Durga Abhushan Bhandar</h1>
        <p>Where Every Ornament Tells a Story of Love, Tradition & Elegance.</p>
      </section>

      <h2 className="home-section-title">Explore Our Collections</h2>

      {loading ? (
        <div className="home-status">Loading...</div>
      ) : products.length === 0 ? (
        <div className="home-status">No products available right now.</div>
      ) : (
        <div className="product-grid home-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      <style>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px 40px;
          box-sizing: border-box;
        }
        .home-hero {
          text-align: center;
          padding: 40px 20px;
          margin-bottom: 28px;
        }
        .home-hero h1 {
          margin: 0 0 12px;
          font-size: 34px;
          line-height: 1.2;
        }
        .home-hero p {
          margin: 0 auto;
          max-width: 560px;
          font-size: 16px;
          opacity: 0.85;
        }
        .home-section-title {
          text-align: center;
          margin: 0 0 20px;
          font-size: 24px;
        }
        .home-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }
        .home-grid > * { min-width: 0; }
        .home-status {
          text-align: center;
          padding: 30px 0;
          opacity: 0.7;
        }

        @media (max-width: 900px) {
          .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        }

        @media (max-width: 640px) {
          .home-page { padding: 12px 10px 24px; }
          .home-hero { padding: 22px 12px; margin-bottom: 16px; }
          .home-hero h1 { font-size: 21px; margin-bottom: 8px; }
          .home-hero p { font-size: 13.5px; line-height: 1.45; }
          .home-section-title { font-size: 17px; margin-bottom: 12px; }
          .home-grid { gap: 10px; }
          .home-grid img { max-width: 100%; height: auto; }
        }
      `}</style>
    </div>
  );
};

export default Home;