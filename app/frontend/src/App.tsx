import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import OnboardingProfile from './pages/OnboardingProfile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

const queryClient = new QueryClient();

function ProtectedWithProfile({ children }: { children: JSX.Element }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)]">
        <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return children;
}

function OnboardingGate() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)]">
        <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (profile) return <Navigate to="/home" replace />;
  return <OnboardingProfile />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/onboarding" element={<OnboardingGate />} />
    <Route
      path="/home"
      element={
        <ProtectedWithProfile>
          <Home />
        </ProtectedWithProfile>
      }
    />
    <Route
      path="/discover"
      element={
        <ProtectedWithProfile>
          <Discover />
        </ProtectedWithProfile>
      }
    />
    <Route
      path="/messages"
      element={
        <ProtectedWithProfile>
          <Messages />
        </ProtectedWithProfile>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedWithProfile>
          <Profile />
        </ProtectedWithProfile>
      }
    />
    <Route
      path="/notifications"
      element={
        <ProtectedWithProfile>
          <Notifications />
        </ProtectedWithProfile>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedWithProfile>
          <Settings />
        </ProtectedWithProfile>
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };