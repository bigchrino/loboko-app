import { Suspense, useEffect } from 'react';
import { rememberAppPath } from '@/lib/app-launch';
import { lazyPage, registerPageRoute } from '@/lib/page-preload';
import NavigationPrefetch from '@/components/NavigationPrefetch';
import RouteLoadBoundary from './components/RouteLoadBoundary';
import { MissedCallsProvider } from '@/contexts/MissedCallsContext';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
const Verification = lazyPage(() => import('./pages/Verification'));
const AdminVerifications = lazyPage(() => import('./pages/AdminVerifications'));
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'));
import AdminRoute from './components/AdminRoute';
const AdminUsers = lazyPage(() => import('./pages/admin/AdminUsers'));
const AdminPosts = lazyPage(() => import('./pages/admin/AdminPosts'));
const AdminStats = lazyPage(() => import('./pages/admin/AdminStats'));
const AdminAds = lazyPage(() => import('./pages/admin/AdminAds'));
const AdminPayments = lazyPage(() => import('./pages/admin/AdminPayments'));
const AdminJournal = lazyPage(() => import('./pages/admin/AdminJournal'));
const MyOrders = lazyPage(() => import('./pages/MyOrders'));
const ServiceOrderDetail = lazyPage(() => import('./pages/ServiceOrderDetail'));
const ReceivedOrders = lazyPage(() => import('./pages/ReceivedOrders'));
const ServicePayment = lazyPage(() => import('./pages/ServicePayment'));

const Index = lazyPage(() => import('./pages/Index'));
const PublicContact = lazyPage(() => import('./pages/PublicContact'));
const AuthCallback = lazyPage(() => import('./pages/AuthCallback'));
const AuthError = lazyPage(() => import('./pages/AuthError'));
const Home = lazyPage(() => import('./pages/Home'));
const Discover = lazyPage(() => import('./pages/Discover'));
const Messages = lazyPage(() => import('./pages/Messages'));
const Calls = lazyPage(() => import('./pages/Calls'));
const Statuses = lazyPage(() => import('./pages/Statuses'));
const GroupChat = lazyPage(() => import('./pages/GroupChat'));
const GroupInfo = lazyPage(() => import('./pages/GroupInfo'));
const StarredMessages = lazyPage(() => import('./pages/StarredMessages'));
const Profile = lazyPage(() => import('./pages/Profile'));
const Notifications = lazyPage(() => import('./pages/Notifications'));
const Settings = lazyPage(() => import('./pages/Settings'));
const OnboardingProfile = lazyPage(() => import('./pages/OnboardingProfile'));
const Suggestion = lazyPage(() => import('./pages/Suggestion'));
const Entreprise = lazyPage(() => import('./pages/Entreprise'));
const CreateCompany = lazyPage(() => import('./pages/CreateCompany'));
const CompanyManage = lazyPage(() => import('./pages/CompanyManage'));
const CompanyDetail = lazyPage(() => import('./pages/CompanyDetail'));
const CompanyJobOffersManage = lazyPage(() => import('./pages/CompanyJobOffersManage'));
const MyMusalaRequests = lazyPage(() => import('./pages/MyMusalaRequests'));
const EntrepriseOffres = lazyPage(() => import('./pages/EntrepriseOffres'));
const EntrepriseMusala = lazyPage(() => import('./pages/EntrepriseMusala'));
const Panier = lazyPage(() => import('./pages/Panier'));
const Marketplace = lazyPage(() => import('./pages/Marketplace'));
const CreateShop = lazyPage(() => import('./pages/CreateShop'));
const ShopManage = lazyPage(() => import('./pages/ShopManage'));
const DiscoverShops = lazyPage(() => import('./pages/DiscoverShops'));
const ShopDetail = lazyPage(() => import('./pages/ShopDetail'));
const ProductDetail = lazyPage(() => import('./pages/ProductDetail'));
const MyProductOrders = lazyPage(() => import('./pages/MyProductOrders'));
const ShopReceivedOrders = lazyPage(() => import('./pages/ShopReceivedOrders'));
const Urgences = lazyPage(() => import('./pages/Urgences'));
const UrgencesHopitaux = lazyPage(() => import('./pages/UrgencesHopitaux'));
const UrgencesPolices = lazyPage(() => import('./pages/UrgencesPolices'));
const UrgencesCasernes = lazyPage(() => import('./pages/UrgencesCasernes'));
const UrgencePrestataires = lazyPage(() => import('./pages/urgences/UrgencePrestataires'));
const Recherches = lazyPage(() => import('./pages/Recherches'));
const Menu = lazyPage(() => import('./pages/Menu'));
const UserProfilePage = lazyPage(() => import('./pages/UserProfile'));
const PostDetail = lazyPage(() => import('./pages/PostDetail'));
const ContactInfo = lazyPage(() => import('./pages/ContactInfo'));
const FindProviders = lazyPage(() => import('./pages/FindProviders'));
const AdminReports = lazyPage(() => import('./pages/AdminReports'));
const ProvidersByCategory = lazyPage(() => import('./pages/ProvidersByCategory'));

const Works = lazyPage(() => import('./pages/Works'));
const ServiceRequests = lazyPage(() => import('./pages/ServiceRequests'));
const ServiceRequestDetail = lazyPage(() => import('./pages/ServiceRequestDetail'));
const ServiceOrder = lazyPage(() => import('./pages/ServiceOrder'));
const Favorites = lazyPage(() => import('./pages/Favorites'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SplashScreen from './components/SplashScreen';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MessagesProvider } from './contexts/MessagesContext';
import { CallProvider } from './contexts/CallContext';
import { PresenceProvider } from './contexts/PresenceContext';
const RoleChangeRequestPage = lazyPage(() => import('./pages/settings/RoleChangeRequestPage'));
const BlockedContacts = lazyPage(() => import('./pages/settings/BlockedContacts'));
const HelpSupport = lazyPage(() => import('./pages/settings/HelpSupport'));
const AdminRoleRequests = lazyPage(() => import('./pages/admin/AdminRoleRequests'));

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

registerPageRoute('/', Index);
registerPageRoute('/onboarding', OnboardingProfile);
registerPageRoute('/contact', PublicContact);
for (const { path, element } of protectedRoutes) {
  const page = element.type === AdminRoute ? element.props.children : element;
  registerPageRoute(path, page.type);
}

const AppRoutes = () => {
  const { pathname, search, hash } = useLocation();
  useEffect(() => { rememberAppPath(pathname + search + hash); }, [pathname, search, hash]);
  return (
  <RouteLoadBoundary resetKey={pathname}>
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
};

const App = () => (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <MessagesProvider>
            <PresenceProvider>
              <CallProvider>
                <MissedCallsProvider>
                    <Toaster />

                    <BrowserRouter future={{ v7_startTransition: true }}>
                      <NavigationPrefetch />
                      <AppRoutes />
                    </BrowserRouter>
                </MissedCallsProvider>
              </CallProvider>
            </PresenceProvider>
          </MessagesProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
);

export default App;
export { AppRoutes };
