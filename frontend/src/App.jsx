import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './context/AuthContext';
import { BadgesProvider } from './context/BadgesContext';
import { LanguageProvider } from './i18n';

import Account from './pages/Account';
import AddProduct from './pages/AddProduct';
import Admin from './pages/Admin';
import Cart from './pages/Cart';
import Events from './pages/Events';
import HowItWorks from './pages/HowItWorks';
import Notifications from './pages/Notifications';
import Sales from './pages/Sales';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import CreateShop from './pages/CreateShop';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
import Purchases from './pages/Purchases';
import Signup from './pages/Signup';
import Welcome from './pages/Welcome';

// Navigation belongs to the in-app screens only — it would be noise on the
// welcome and auth screens, which are full-bleed on every size.
const NAVLESS = ['/', '/login', '/signup'];

function Shell() {
  const { pathname } = useLocation();
  const showNav = !NAVLESS.includes(pathname);

  return (
    <AppShell nav={showNav}>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Browsing is deliberately public — the backend's /products/nearby
            needs no token, and a customer shouldn't have to sign up to look. */}
        <Route path="/feed" element={<Feed />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/events" element={<Events />} />
        <Route path="/how-it-works" element={<HowItWorks />} />

        <Route
          path="/purchases"
          element={
            <ProtectedRoute role="customer">
              <Purchases />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <ProtectedRoute role="customer">
              <Cart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute role="customer">
              <Wishlist />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artisan/sales"
          element={
            <ProtectedRoute role="artisan">
              <Sales />
            </ProtectedRoute>
          }
        />

        <Route
          path="/artisan"
          element={
            <ProtectedRoute role="artisan">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artisan/shop"
          element={
            <ProtectedRoute role="artisan">
              <CreateShop />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artisan/edit/:id"
          element={
            <ProtectedRoute role="artisan">
              <AddProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/artisan/add"
          element={
            <ProtectedRoute role="artisan">
              <AddProduct />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <BadgesProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </BadgesProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
