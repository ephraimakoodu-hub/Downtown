import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'ds_cart_v1';
const MAX_QTY = 50;
const CartContext = createContext(null);

// Only product ids and quantities are stored in the browser. Prices always come from the server.
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => Number.isInteger(i.productId) && Number.isInteger(i.quantity) && i.quantity > 0).slice(0, 100) : [];
  } catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage may be blocked */ }
  }, [items]);

  const value = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    add: (productId, quantity = 1) => setItems((cur) => {
      const found = cur.find((i) => i.productId === productId);
      if (found) return cur.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i));
      return [...cur, { productId, quantity: Math.min(MAX_QTY, quantity) }];
    }),
    setQuantity: (productId, quantity) => setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(MAX_QTY, quantity)) } : i))),
    remove: (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId)),
    clear: () => setItems([]),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
