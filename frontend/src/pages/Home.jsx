
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShoppingBasket,
  PackageCheck,
  Truck,
  Store,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { business } from '../config.js';
import { useFetch } from '../lib/useFetch.js';

const categoryIcons = [
  ShoppingBasket,
  PackageCheck,
  Store,
  Truck,
  Search,
  ShieldCheck,
];

export default function Home() {
  const { status, data } = useFetch('/categories');
  const top = (data?.items || []).filter((c) => !c.parentId);

  return (
    <>
      <section className="hero home-hero" aria-labelledby="hero-title">
        <div className="container hero-inner home-hero-inner">
          <div className="home-hero-content">
            <span className="home-eyebrow">
              <ShoppingBasket size={16} />
              YOUR NEIGHBOURHOOD MALL
            </span>

            <h1 id="hero-title">
              Everything you need, all in one place.
            </h1>

            <p>
              Shop groceries and household essentials from{' '}
              {business.tradingName}, {business.town}. Browse our products,
              check availability and order with ease.
            </p>

            <div className="home-hero-actions">
              <Link className="btn home-shop-btn" to="/products">
                Shop <ArrowRight size={18} />
              </Link>

              <Link className="home-secondary-link" to="/products">
                Explore products
              </Link>
            </div>

            <div className="home-trust-row">
              <span><PackageCheck size={16} /> Easy ordering</span>
              <span><ShieldCheck size={16} /> Order tracking</span>
            </div>
          </div>

          <div className="home-how-card">
            <span className="home-card-icon">
              <ShoppingBasket size={24} />
            </span>

            <h2>Shopping made simple</h2>
            <p>Getting your essentials is just a few steps away.</p>

            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Choose your products</strong>
                  <small>Browse and add items to your cart.</small>
                </div>
              </li>

              <li>
                <span>02</span>
                <div>
                  <strong>Choose how to receive them</strong>
                  <small>Select delivery or pickup when available.</small>
                </div>
              </li>

              <li>
                <span>03</span>
                <div>
                  <strong>Place and track your order</strong>
                  <small>Follow your order from your account.</small>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <div className="container page home-page">
        <section className="section home-category-section" aria-labelledby="cat-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-eyebrow">FIND WHAT YOU NEED</span>
              <h2 id="cat-title">Shop by category</h2>
              <p className="muted">Explore our product departments.</p>
            </div>

            <Link className="home-view-all" to="/products">
              View all <ArrowRight size={16} />
            </Link>
          </div>

          {status === 'loading' && (
            <div
              className="skeleton"
              style={{ height: 160 }}
              role="status"
              aria-label="Loading categories"
            />
          )}

          {status === 'error' && (
            <p className="muted">
              Categories could not be loaded right now. You can still{' '}
              <Link to="/products">browse all products</Link>.
            </p>
          )}

          {status === 'ready' && top.length === 0 && (
            <p className="muted">No categories have been added yet.</p>
          )}

          {status === 'ready' && top.length > 0 && (
            <ul className="category-grid home-category-grid">
              {top.map((c, index) => {
                const Icon = categoryIcons[index % categoryIcons.length];

                return (
                  <li key={c.id}>
                    <Link
                      className="home-category-card"
                      to={`/products?category=${encodeURIComponent(c.slug)}`}
                    >
                      <span className="home-category-icon">
                        <Icon size={25} />
                      </span>

                      <span className="home-category-name">{c.name}</span>

                      <span className="home-category-arrow">
                        <ArrowRight size={18} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="home-bottom-cta">
          <div>
            <span>READY TO SHOP?</span>
            <h2>Your next shopping trip starts here.</h2>
            <p>Explore the products available at {business.tradingName}.</p>
          </div>

          <Link className="btn" to="/products">
            Browse products <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    </>
  );
}
