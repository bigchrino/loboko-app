import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Chargement...
      </div>
    );
  }

  if (!profile?.is_admin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
