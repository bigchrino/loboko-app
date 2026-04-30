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
import Calls from './pages/Calls';
import GroupChat from './pages/GroupChat';
import GroupInfo from './pages/GroupInfo';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import OnboardingProfile from './pages/OnboardingProfile';
import Suggestion from './pages/Suggestion';
import Entreprise from './pages/Entreprise';
import EntrepriseOffres from './pages/EntrepriseOffres';
import EntrepriseMusala from './pages/EntrepriseMusala';
import Panier from './pages/Panier';
import Urgences from './pages/Urgences';
import UrgencesHopitaux from './pages/UrgencesHopitaux';
import UrgencesPolices from './pages/UrgencesPolices';
import UrgencesCasernes from './pages/UrgencesCasernes';
import Recherches from './pages/Recherches';
import Menu from './pages/Menu';
import UserProfilePage from './pages/UserProfile';
import ContactInfo from './pages/ContactInfo';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MessagesProvider } from './contexts/MessagesContext';
import { CallProvider } from './contexts/CallContext';
import { PresenceProvider } from './contexts/PresenceContext';

const queryClient = new QueryClient();

function ProtectedWithProfile({ children }: { children: JSX.Element }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)]">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
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
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (profile) return <Navigate to="/home" replace />;
  return <OnboardingProfile />;
}

const protectedRoutes: Array<{ path: string; element: JSX.Element }> = [
  { path: '/home', element: <Home /> },
  { path: '/discover', element: <Discover /> },
  { path: '/messages', element: <Messages /> },
  { path: '/calls', element: <Calls /> },
  { path: '/messages/group/:groupId', element: <GroupChat /> },
  { path: '/messages/group/:groupId/info', element: <GroupInfo /> },
  { path: '/profile', element: <Profile /> },
  { path: '/notifications', element: <Notifications /> },
  { path: '/settings', element: <Settings /> },
  { path: '/suggestion', element: <Suggestion /> },
  { path: '/entreprise', element: <Entreprise /> },
  { path: '/entreprise/offres', element: <EntrepriseOffres /> },
  { path: '/entreprise/musala', element: <EntrepriseMusala /> },
  { path: '/panier', element: <Panier /> },
  { path: '/urgences', element: <Urgences /> },
  { path: '/urgences/hopitaux', element: <UrgencesHopitaux /> },
  { path: '/urgences/polices', element: <UrgencesPolices /> },
  { path: '/urgences/casernes', element: <UrgencesCasernes /> },
  { path: '/recherches', element: <Recherches /> },
  { path: '/menu', element: <Menu /> },
  { path: '/u/:userId', element: <UserProfilePage /> },
  { path: '/messages/contact/:userId', element: <ContactInfo /> },
];

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/onboarding" element={<OnboardingGate />} />
    {protectedRoutes.map(({ path, element }) => (
      <Route
        key={path}
        path={path}
        element={<ProtectedWithProfile>{element}</ProtectedWithProfile>}
      />
    ))}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <MessagesProvider>
            <PresenceProvider>
              <CallProvider>
                <TooltipProvider>
                  <Toaster />
                  <BrowserRouter>
                    <AppRoutes />
                  </BrowserRouter>
                </TooltipProvider>
              </CallProvider>
            </PresenceProvider>
          </MessagesProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };