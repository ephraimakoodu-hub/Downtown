import { Link } from 'react-router-dom';
import { formatNaira } from '../lib/api.js';
import AddToCart from './AddToCart.jsx';

const STOCK = {
  in_stock: ['badge-ok', 'In stock'],
  low_stock: ['badge-low', 'Low stock'],
  out_of_stock: ['badge-out', 'Out of stock'],
};

export function StockBadge({ stock }) {
  const [cls, label] = STOCK[stock] || STOCK.out_of_stock;
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function ProductCard({ product: p }) {
  const discounted = p.compareAtPriceKobo && p.compareAtPriceKobo > p.priceKobo;
  return (
    <li className="product-card">
      <div className="thumb">
        {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" width="300" height="300" /> : <span>No image yet</span>}
      </div>
      <div className="body">
        <Link className="title" to={`/products/${p.slug}`}>{p.name}</Link>
        <span className="muted">{p.brand ? `${p.brand} · ` : ''}{p.category}</span>
        <span className="price">
          {formatNaira(p.priceKobo)}
          {discounted && <s><span className="visually-hidden">Was </span>{formatNaira(p.compareAtPriceKobo)}</s>}
        </span>
        <StockBadge stock={p.stock} />
        <AddToCart product={p} />
      </div>
    </li>
  );
}
