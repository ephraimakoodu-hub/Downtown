import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, User, ShoppingCart } from 'lucide-react';
import { useCart } from '../lib/cart.jsx';
import { business } from '../config.js';

export default function Header() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { count } = useCart();

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products');
  }

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link to="/" className="brand">
          {business.logoUrl ? <img src={business.logoUrl} alt="" width="36" height="36" /> : <span className="brand-mark" aria-hidden="true">DS</span>}
          <span>{business.tradingName}</span>
        </Link>
        <form className="header-search" role="search" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="site-search">Search products</label>
          <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product name, SKU or barcode" maxLength={80} />
          <button className="btn" type="submit"><Search size={18} aria-hidden="true" /> Search</button>
        </form>
        <nav className="nav" aria-label="Main">
          <NavLink to="/products">Shop groceries</NavLink>
          <NavLink to="/account"><User size={18} aria-hidden="true" /> My account</NavLink>
          <NavLink to="/cart"><ShoppingCart size={18} aria-hidden="true" /> Cart ({count}<span className="visually-hidden"> items</span>)</NavLink>
        </nav>
      </div>
    </header>
  );
}
