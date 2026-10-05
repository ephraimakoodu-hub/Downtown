
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  ShoppingCart,
  Home,
  Store,
  Menu,
  X,
} from 'lucide-react';
import { useCart } from '../lib/cart.jsx';
import { business } from '../config.js';

export default function Header() {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { count } = useCart();

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products');
    setMenuOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-row">

          <div className="header-top">
            <Link to="/" className="brand" onClick={closeMenu}>
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt=""
                  width="36"
                  height="36"
                />
              ) : (
                <span className="brand-mark" aria-hidden="true">DS</span>
              )}

              <span>{business.tradingName}</span>
            </Link>

            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          <form
            className="header-search"
            role="search"
            onSubmit={submit}
          >
            <label
              className="visually-hidden"
              htmlFor="site-search"
            >
              Search products
            </label>

            <input
              id="site-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products..."
              maxLength={80}
            />

            <button className="btn" type="submit">
              <Search size={18} aria-hidden="true" />
              <span>Search</span>
            </button>
          </form>

          <nav className={`nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main">
            <NavLink to="/products" onClick={closeMenu}>
              <Store size={18} aria-hidden="true" />
              Shop groceries
            </NavLink>

            <NavLink to="/account" onClick={closeMenu}>
              <User size={18} aria-hidden="true" />
              My account
            </NavLink>

            <NavLink to="/cart" onClick={closeMenu}>
              <ShoppingCart size={18} aria-hidden="true" />
              Cart ({count})
            </NavLink>
          </nav>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <Home size={21} aria-hidden="true" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/products" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <Store size={21} aria-hidden="true" />
          <span>Shop</span>
        </NavLink>

        <NavLink to="/cart" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <span className="mobile-cart-icon">
            <ShoppingCart size={21} aria-hidden="true" />
            {count > 0 && <span className="mobile-cart-count">{count}</span>}
          </span>
          <span>Cart</span>
        </NavLink>

        <NavLink to="/account" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <User size={21} aria-hidden="true" />
          <span>Account</span>
        </NavLink>
      </nav>
    </>
  );
}