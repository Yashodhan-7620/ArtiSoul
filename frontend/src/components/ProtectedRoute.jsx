import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// `role` optionally narrows access further: role="artisan" or role={['customer', 'admin']}.
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && ![].concat(role).includes(user.role)) {
    return <Navigate to="/feed" replace />;
  }

  return children;
}
