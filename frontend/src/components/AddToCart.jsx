import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../lib/cart.jsx';

export default function AddToCart({ product, showQuantity = false }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const out = product.stock === 'out_of_stock';

  function click() {
    add(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="add-to-cart">
      {showQuantity && (
        <div className="field" style={{ maxWidth: 120 }}>
          <label htmlFor={`qty-${product.id}`}>Quantity</label>
          <input id={`qty-${product.id}`} type="number" min="1" max="50" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
        </div>
      )}
      <button className="btn" type="button" disabled={out} onClick={click} aria-label={`Add ${product.name} to cart`}>
        <ShoppingCart size={18} aria-hidden="true" /> {out ? 'Out of stock' : 'Add to cart'}
      </button>
      <span role="status" className="visually-hidden">{added ? `${product.name} added to cart` : ''}</span>
    </div>
  );
}
