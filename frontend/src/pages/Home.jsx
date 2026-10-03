import { Link } from 'react-router-dom';
import { business } from '../config.js';
import { useFetch } from '../lib/useFetch.js';

export default function Home() {
  const { status, data } = useFetch('/categories');
  const top = (data?.items || []).filter((c) => !c.parentId);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div>
            <h1 id="hero-title">Groceries and household items from {business.tradingName}, {business.town}</h1>
            <p>Browse the supermarket's products online, check what is in stock, and search by name, SKU or barcode.</p>
            <Link className="btn" to="/products">Shop groceries</Link>
          </div>
          <div>
            <h2>How ordering works</h2>
            <ol className="muted">
              <li>Add products to your cart and create an account.</li>
              <li>Choose delivery or pickup, if the supermarket has switched them on.</li>
              <li>Place the order and follow its status under My orders.</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="container page">
        <section className="section" aria-labelledby="cat-title">
          <h2 id="cat-title">Shop by category</h2>
          {status === 'loading' && <div className="skeleton" style={{ height: 72 }} role="status" aria-label="Loading categories" />}
          {status === 'error' && <p className="muted">Categories could not be loaded right now. You can still <Link to="/products">browse all products</Link>.</p>}
          {status === 'ready' && top.length === 0 && <p className="muted">No categories have been added yet.</p>}
          {status === 'ready' && top.length > 0 && (
            <ul className="category-grid">
              {top.map((c) => <li key={c.id}><Link to={`/products?category=${encodeURIComponent(c.slug)}`}>{c.name}</Link></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
