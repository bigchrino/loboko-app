import { MissedCallsProvider } from '@/contexts/MissedCallsContext';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Verification from './pages/Verification';
import AdminVerifications from './pages/AdminVerifications';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPosts from './pages/admin/AdminPosts';
import AdminStats from './pages/admin/AdminStats';
import MyOrders from './pages/MyOrders';
import ServiceOrderDetail from './pages/ServiceOrderDetail';
import ReceivedOrders from './pages/ReceivedOrders';
import ServicePayment from './pages/ServicePayment';

import Index from './pages/Index';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import Calls from './pages/Calls';
import Statuses from './pages/Statuses';
import GroupChat from './pages/GroupChat';
import GroupInfo from './pages/GroupInfo';
import StarredMessages from './pages/StarredMessages';
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
import UrgencePrestataires from './pages/urgences/UrgencePrestataires';
import Recherches from './pages/Recherches';
import Menu from './pages/Menu';
import UserProfilePage from './pages/UserProfile';
import PostDetail from './pages/PostDetail';
import ContactInfo from './pages/ContactInfo';
import FindProviders from './pages/FindProviders';
import AdminReports from './pages/AdminReports';
import ProvidersByCategory from './pages/ProvidersByCategory';

import Works from './pages/Works';
import ServiceRequests from './pages/ServiceRequests';
import ServiceRequestDetail from './pages/ServiceRequestDetail';
import ServiceOrder from './pages/ServiceOrder';
import Favorites from './pages/Favorites';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MessagesProvider } from './contexts/MessagesContext';
import { CallProvider } from './contexts/CallContext';
import { PresenceProvider } from './contexts/PresenceContext';
import RoleChangeRequestPage from './pages/settings/RoleChangeRequestPage';
import AdminRoleRequests from './pages/admin/AdminRoleRequests';

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
  { path: '/statuses', element: <Statuses /> },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <AdminRoute>
        <AdminUsers />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/posts',
    element: (
      <AdminRoute>
        <AdminPosts />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/role-requests',
    element: (
      <AdminRoute>
        <AdminRoleRequests />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/stats',
    element: (
      <AdminRoute>
        <AdminStats />
      </AdminRoute>
    ),
  },

  { path: '/messages/group/:groupId', element: <GroupChat /> },
  { path: '/messages/group/:groupId/info', element: <GroupInfo /> },

  { path: '/messages/starred', element: <StarredMessages /> },

  { path: '/profile', element: <Profile /> },
  { path: '/notifications', element: <Notifications /> },
  { path: '/settings', element: <Settings /> },
  { path: '/settings/role-change', element: <RoleChangeRequestPage /> },

  { path: '/suggestion', element: <Suggestion /> },

  { path: '/entreprise', element: <Entreprise /> },
  { path: '/entreprise/offres', element: <EntrepriseOffres /> },
  { path: '/entreprise/musala', element: <EntrepriseMusala /> },

  { path: '/panier', element: <Panier /> },

  { path: '/urgences', element: <Urgences /> },
  { path: '/urgences/hopitaux', element: <UrgencesHopitaux /> },
  { path: '/urgences/polices', element: <UrgencesPolices /> },
  { path: '/urgences/casernes', element: <UrgencesCasernes /> },
  { path: '/urgences/prestataires', element: <UrgencePrestataires /> },

  { path: '/recherches', element: <Recherches /> },
  { path: '/menu', element: <Menu /> },

  { path: '/u/:userId', element: <UserProfilePage /> },

  { path: '/post/:postId', element: <PostDetail /> },

  { path: '/messages/contact/:userId', element: <ContactInfo /> },

  { path: '/find', element: <FindProviders /> },
  { path: '/services/:slug', element: <ProvidersByCategory /> },
  { path: '/services/order/:userId', element: <ServiceOrder /> },

  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/reports',
    element: (
      <AdminRoute>
        <AdminReports />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/verifications',
    element: (
      <AdminRoute>
        <AdminVerifications />
      </AdminRoute>
    ),
  },
  {
    path: '/admin/reports',
    element: (
       <AdminRoute>
        <AdminReports />
      </AdminRoute>
     ),
  },

  /* Marketplace */
  { path: '/works', element: <Works /> },

  { path: '/requests', element: <ServiceRequests /> },
  { path: '/my-orders', element: <MyOrders /> },
  {
    path: '/payments/:orderId',
    element: <ServicePayment />,
  },
  { path: '/my-orders/:orderId', element: <ServiceOrderDetail /> },
  { path: '/requests/:requestId', element: <ServiceRequestDetail /> },
  { path: '/received-orders', element: <ReceivedOrders /> },

  { path: '/favorites', element: <Favorites /> },
  { path: '/verification', element: <Verification /> },
  { path: '/admin/verifications', element: <AdminVerifications /> },
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
                <MissedCallsProvider>
                  <TooltipProvider>
                    <Toaster />

                    <BrowserRouter>
                      <AppRoutes />
                    </BrowserRouter>
                  </TooltipProvider>
                </MissedCallsProvider>
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
