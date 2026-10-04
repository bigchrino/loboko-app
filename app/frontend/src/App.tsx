import { lazy, Suspense } from 'react';
import RouteLoadBoundary from './components/RouteLoadBoundary';
import { MissedCallsProvider } from '@/contexts/MissedCallsContext';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
const Verification = lazy(() => import('./pages/Verification'));
const AdminVerifications = lazy(() => import('./pages/AdminVerifications'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
import AdminRoute from './components/AdminRoute';
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPosts = lazy(() => import('./pages/admin/AdminPosts'));
const AdminStats = lazy(() => import('./pages/admin/AdminStats'));
const AdminAds = lazy(() => import('./pages/admin/AdminAds'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const ServiceOrderDetail = lazy(() => import('./pages/ServiceOrderDetail'));
const ReceivedOrders = lazy(() => import('./pages/ReceivedOrders'));
const ServicePayment = lazy(() => import('./pages/ServicePayment'));

const Index = lazy(() => import('./pages/Index'));
const PublicContact = lazy(() => import('./pages/PublicContact'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const AuthError = lazy(() => import('./pages/AuthError'));
const Home = lazy(() => import('./pages/Home'));
const Discover = lazy(() => import('./pages/Discover'));
const Messages = lazy(() => import('./pages/Messages'));
const Calls = lazy(() => import('./pages/Calls'));
const Statuses = lazy(() => import('./pages/Statuses'));
const GroupChat = lazy(() => import('./pages/GroupChat'));
const GroupInfo = lazy(() => import('./pages/GroupInfo'));
const StarredMessages = lazy(() => import('./pages/StarredMessages'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const OnboardingProfile = lazy(() => import('./pages/OnboardingProfile'));
const Suggestion = lazy(() => import('./pages/Suggestion'));
const Entreprise = lazy(() => import('./pages/Entreprise'));
const CreateCompany = lazy(() => import('./pages/CreateCompany'));
const CompanyManage = lazy(() => import('./pages/CompanyManage'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const CompanyJobOffersManage = lazy(() => import('./pages/CompanyJobOffersManage'));
const MyMusalaRequests = lazy(() => import('./pages/MyMusalaRequests'));
const EntrepriseOffres = lazy(() => import('./pages/EntrepriseOffres'));
const EntrepriseMusala = lazy(() => import('./pages/EntrepriseMusala'));
const Panier = lazy(() => import('./pages/Panier'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const CreateShop = lazy(() => import('./pages/CreateShop'));
const ShopManage = lazy(() => import('./pages/ShopManage'));
const DiscoverShops = lazy(() => import('./pages/DiscoverShops'));
const ShopDetail = lazy(() => import('./pages/ShopDetail'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const MyProductOrders = lazy(() => import('./pages/MyProductOrders'));
const ShopReceivedOrders = lazy(() => import('./pages/ShopReceivedOrders'));
const Urgences = lazy(() => import('./pages/Urgences'));
const UrgencesHopitaux = lazy(() => import('./pages/UrgencesHopitaux'));
const UrgencesPolices = lazy(() => import('./pages/UrgencesPolices'));
const UrgencesCasernes = lazy(() => import('./pages/UrgencesCasernes'));
const UrgencePrestataires = lazy(() => import('./pages/urgences/UrgencePrestataires'));
const Recherches = lazy(() => import('./pages/Recherches'));
const Menu = lazy(() => import('./pages/Menu'));
const UserProfilePage = lazy(() => import('./pages/UserProfile'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const ContactInfo = lazy(() => import('./pages/ContactInfo'));
const FindProviders = lazy(() => import('./pages/FindProviders'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const ProvidersByCategory = lazy(() => import('./pages/ProvidersByCategory'));

const Works = lazy(() => import('./pages/Works'));
const ServiceRequests = lazy(() => import('./pages/ServiceRequests'));
const ServiceRequestDetail = lazy(() => import('./pages/ServiceRequestDetail'));
const ServiceOrder = lazy(() => import('./pages/ServiceOrder'));
const Favorites = lazy(() => import('./pages/Favorites'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SplashScreen from './components/SplashScreen';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MessagesProvider } from './contexts/MessagesContext';
import { CallProvider } from './contexts/CallContext';
import { PresenceProvider } from './contexts/PresenceContext';
const RoleChangeRequestPage = lazy(() => import('./pages/settings/RoleChangeRequestPage'));
const BlockedContacts = lazy(() => import('./pages/settings/BlockedContacts'));
const HelpSupport = lazy(() => import('./pages/settings/HelpSupport'));
const AdminRoleRequests = lazy(() => import('./pages/admin/AdminRoleRequests'));

const queryClient = new QueryClient();

function ProtectedWithProfile({ children }: { children: JSX.Element }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) return <Navigate to="/" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;

  return children;
}

function OnboardingGate() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) return <Navigate to="/" replace />;
  if (profile) return <Navigate to="/home" replace />;

  return <OnboardingProfile />;
}

const protectedRoutes: Array<{ path: string; element: JSX.Element }> = [
  {path:'/admin/ads',element:<AdminRoute><AdminAds /></AdminRoute>},
  {path:'/admin/payments',element:<AdminRoute><AdminPayments /></AdminRoute>},
  {path:'/admin/journal',element:<AdminRoute><AdminJournal /></AdminRoute>},
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
  { path: '/settings/privacy', element: <BlockedContacts /> },
  { path: '/settings/help', element: <HelpSupport /> },

  { path: '/suggestion', element: <Suggestion /> },

  { path: '/entreprise', element: <Entreprise /> },
  { path: '/entreprise/create', element: <CreateCompany /> },
  { path: '/entreprise/manage', element: <CompanyManage /> },
  { path: '/entreprise/company/:slug', element: <CompanyDetail /> },
  { path: '/entreprise/offres/manage', element: <CompanyJobOffersManage /> },
  { path: '/musala/manage', element: <MyMusalaRequests /> },
  { path: '/entreprise/offres', element: <EntrepriseOffres /> },
  { path: '/entreprise/musala', element: <EntrepriseMusala /> },

  { path: '/cart', element: <Panier /> },
  { path: '/marketplace', element: <Marketplace /> },
  { path: '/shop/create', element: <CreateShop /> },
  { path: '/shop/manage', element: <ShopManage /> },
  { path: '/shops', element: <DiscoverShops /> },
  { path: '/shop/:slug', element: <ShopDetail /> },
  { path: '/product/:id', element: <ProductDetail /> },
  { path: '/my-product-orders', element: <MyProductOrders /> },
  { path: '/shop/orders', element: <ShopReceivedOrders /> },

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
];

function RoutePending() {
  const { loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <div role="status" className="min-h-[50dvh] flex items-center justify-center text-sm text-[var(--loboko-text-muted)]">
      Chargement de la page…
    </div>
  );
}

const AppRoutes = () => (
  <RouteLoadBoundary>
  <Suspense fallback={<RoutePending />}>
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/panier" element={<Navigate to="/marketplace" replace />} />
    <Route path="/contact" element={<PublicContact />} />

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
  </Suspense>
  </RouteLoadBoundary>
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

                    <BrowserRouter future={{ v7_startTransition: true }}>
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
