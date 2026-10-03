import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../lib/useFetch.js';
import { formatNaira } from '../lib/api.js';
import { StockBadge } from '../components/ProductCard.jsx';
import { ErrorState, EmptyState } from '../components/States.jsx';
import AddToCart from '../components/AddToCart.jsx';
import ProductReviews from '../components/ProductReviews.jsx';

export default function ProductDetail() {
  const { slug } = useParams();
  const { status, data, error, retry } = useFetch(`/products/${encodeURIComponent(slug)}`);

  return (
    <div className="container page">
      {status === 'loading' && <div className="skeleton" style={{ height: 360 }} role="status" aria-label="Loading product" />}
      {status === 'error' && error.status === 404 && (
        <EmptyState title="This product is not available" actions={<Link className="btn" to="/products">Shop groceries</Link>}>
          It may have been removed or is not published yet.
        </EmptyState>
      )}
      {status === 'error' && error.status !== 404 && <ErrorState message={error.message} onRetry={retry} />}
      {status === 'ready' && (() => {
        const p = data.product;
        return (
          <article className="detail">
            <div className="image">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span className="muted">No image yet</span>}</div>
            <div>
              <p className="muted"><Link to={`/products?category=${encodeURIComponent(p.categorySlug)}`}>{p.category}</Link>{p.brand ? ` · ${p.brand}` : ''}</p>
              <h1>{p.name}</h1>
              <p className="price" style={{ fontSize: 'var(--text-xl)' }}>{formatNaira(p.priceKobo)}</p>
              <p><StockBadge stock={p.stock} /></p>
              {p.description && <p>{p.description}</p>}
              <dl className="muted">
                <dt className="visually-hidden">SKU</dt><dd style={{ margin: 0 }}>SKU: {p.sku}</dd>
                {p.barcode && <><dt className="visually-hidden">Barcode</dt><dd style={{ margin: 0 }}>Barcode: {p.barcode}</dd></>}
              </dl>
              <AddToCart product={p} showQuantity />
            </div>
          </article>
        );
      })()}
      {status === 'ready' && <ProductReviews slug={data.product.slug} />}
    </div>
  );
}
