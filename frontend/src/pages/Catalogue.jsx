import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../lib/useFetch.js';
import ProductCard from '../components/ProductCard.jsx';
import { LoadingGrid, ErrorState, EmptyState } from '../components/States.jsx';

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const cats = useFetch('/categories');
  const page = Math.max(1, Number(params.get('page')) || 1);

  const query = new URLSearchParams();
  for (const k of ['q', 'category', 'sort', 'inStock']) if (params.get(k)) query.set(k, params.get(k));
  query.set('page', String(page));
  const { status, data, error, retry } = useFetch(`/products?${query}`);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = ['q', 'category', 'inStock'].some((k) => params.get(k));

  return (
    <div className="container page">
      <h1>{params.get('q') ? `Results for "${params.get('q')}"` : 'Shop groceries'}</h1>
      <div className="catalogue">
        <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="Filter products">
          <details open>
            <summary>Filters</summary>
            <div className="field">
              <label htmlFor="f-cat">Category</label>
              <select id="f-cat" value={params.get('category') || ''} onChange={(e) => update({ category: e.target.value })}>
                <option value="">All categories</option>
                {(cats.data?.items || []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <label className="check">
              <input type="checkbox" checked={params.get('inStock') === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })} />
              In stock only
            </label>
          </details>
        </form>

        <section aria-label="Products">
          <div className="toolbar">
            <p className="muted" role="status">{status === 'ready' ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}</p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="f-sort">Sort by</label>
              <select id="f-sort" value={params.get('sort') || 'name'} onChange={(e) => update({ sort: e.target.value })}>
                <option value="name">Name, A to Z</option>
                <option value="price_asc">Price, low to high</option>
                <option value="price_desc">Price, high to low</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
          </div>

          {status === 'loading' && <LoadingGrid />}
          {status === 'error' && <ErrorState message={error.message} onRetry={retry} />}
          {status === 'ready' && data.items.length === 0 && (
            hasFilters ? (
              <EmptyState title="No products match your search" actions={<button className="btn" type="button" onClick={() => setParams({})}>Clear search and filters</button>}>
                Check the spelling, try a shorter search, or remove a filter.
              </EmptyState>
            ) : (
              <EmptyState title="No products have been added yet">Products will appear here once the supermarket adds them.</EmptyState>
            )
          )}
          {status === 'ready' && data.items.length > 0 && (
            <>
              <ul className="product-grid">{data.items.map((p) => <ProductCard key={p.id} product={p} />)}</ul>
              <nav className="pagination" aria-label="Pagination">
                <button className="btn btn-secondary" type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous page</button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-secondary" type="button" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Next page</button>
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
