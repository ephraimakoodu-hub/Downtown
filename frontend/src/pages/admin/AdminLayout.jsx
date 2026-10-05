import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth, can, isStaff } from '../../lib/auth.jsx';
import { AuthForm } from '../Account.jsx';
import { EmptyState } from '../../components/States.jsx';

const NAV = [
  ['/admin', 'Dashboard', 'reports.read', true],
  ['/admin/orders', 'Orders', 'orders.read'],
  ['/admin/products', 'Products', 'products.read'],
  ['/admin/inventory', 'Inventory', 'inventory.read'],
  ['/admin/catalogue-data', 'Categories, brands, suppliers', 'products.write'],
  ['/admin/purchase-orders', 'Purchase orders', 'purchasing.manage'],
  ['/admin/refunds', 'Refunds', 'orders.read'],
  ['/admin/reviews', 'Reviews', 'reviews.moderate'],
  ['/admin/users', 'Customers and staff', 'customers.read'],
  ['/admin/audit-logs', 'Audit log', 'audit.read'],
  ['/admin/settings', 'Settings', 'settings.manage'],
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  if (user === undefined) return <div className="container page"><div className="skeleton" style={{ height: 200 }} role="status" aria-label="Loading" /></div>;
  if (!user) return <AuthForm />;
  if (!isStaff(user)) return <div className="container page"><EmptyState title="Staff access only" actions={<Link className="btn" to="/">Go to the shop</Link>}>Your account does not have access to this area.</EmptyState></div>;
  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">Skip to main content</a>
      <header className="admin-top">
        <strong>Downtown F & M staff</strong>
        <span className="muted">{user.fullName} ({user.role.replace('_', ' ')})</span>
        <Link to="/">View shop</Link>
        <button className="btn btn-secondary" type="button" onClick={logout}>Sign out</button>
      </header>
      <div className="admin-body">
        <nav className="admin-nav" aria-label="Staff">
          <ul>{NAV.filter(([, , p]) => can(user, p)).map(([to, label, , end]) => <li key={to}><NavLink to={to} end={Boolean(end)}>{label}</NavLink></li>)}</ul>
        </nav>
        <main id="admin-main" tabIndex={-1} className="admin-main"><Outlet /></main>
      </div>
    </div>
  );
}
