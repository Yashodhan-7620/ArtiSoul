import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './context/AuthContext';

import Account from './pages/Account';
import AddProduct from './pages/AddProduct';
import CreateShop from './pages/CreateShop';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
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
        <Route path="/account" element={<Account />} />

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
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
