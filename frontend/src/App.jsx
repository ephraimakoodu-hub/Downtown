import { Routes, Route, Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import EmailVerifyBanner from './components/EmailVerifyBanner.jsx';
import Home from './pages/Home.jsx';
import Catalogue from './pages/Catalogue.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Account from './pages/Account.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { OrderList, OrderDetail } from './pages/Orders.jsx';
import MyReviews from './pages/MyReviews.jsx';
import { Privacy, Terms, Cookies, Refunds } from './pages/Legal.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import { ProductList, ProductForm } from './pages/admin/Products.jsx';
import Inventory from './pages/admin/Inventory.jsx';
import { AdminOrders, AdminOrderDetail, Refunds as AdminRefunds } from './pages/admin/Orders.jsx';
import { CatalogueData, PurchaseOrders, Users, AuditLogs, Settings, ReviewModeration } from './pages/admin/Manage.jsx';

function StoreShell() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <Header />
      <main id="main" tabIndex={-1}><div className="container"><EmailVerifyBanner /></div><Outlet /></main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:ref" element={<AdminOrderDetail />} />
        <Route path="products" element={<ProductList />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="catalogue-data" element={<CatalogueData />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="refunds" element={<AdminRefunds />} />
        <Route path="reviews" element={<ReviewModeration />} />
        <Route path="users" element={<Users />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route element={<StoreShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Catalogue />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/orders" element={<OrderList />} />
        <Route path="/account/orders/:ref" element={<OrderDetail />} />
        <Route path="/account/reviews" element={<MyReviews />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
