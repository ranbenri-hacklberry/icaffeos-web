import React from "react";
import { BrowserRouter, HashRouter, Routes as RouterRoutes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MayaAuthProvider, useMayaAuth } from "./context/MayaAuthContext";
import { MusicProvider } from "./context/MusicContext";
import SyncStatusModal from "./components/SyncStatusModal";
import ConnectivityStatus from "./components/ConnectivityStatus";
import MiniMusicBar from './components/music/MiniMusicBar';
// SyncManager removed as per user request
import LoginGateway from './components/LoginGateway';
import OrderPusher from './components/OrderPusher';
import { isElectron } from "./utils/apiUtils";

// Abrakadabra Engine
import { AbraHatProvider } from "./context/AbraHatContext";
import AbraPreviewDrawer from "./components/abrakadabra/shared/AbraPreviewDrawer";
import AbraInspector from "./components/abrakadabra/shared/AbraInspector";


// Pages
import LoginScreen from "./pages/login/LoginScreen";
import ModeSelectionScreen from "./pages/login/ModeSelectionScreen";
import HierarchicalDashboard from "./pages/login/HierarchicalDashboard";
import ConnectPage from "./pages/login/ConnectPage";
import MenuOrderingInterface from './pages/menu-ordering-interface';
import KdsScreen from './pages/kds';
import DataManagerInterface from './pages/data-manager-interface';
import SuperAdminDashboard from './pages/super-admin';
import SuperAdminPortal from './pages/super-admin/SuperAdminPortal';
import DatabaseExplorer from './pages/super-admin/DatabaseExplorer';
import ManagerKDS from './components/manager/ManagerKDS';
import InventoryPage from './pages/inventory';
import PrepPage from './pages/prep';
import MusicPage from './pages/music';
import YouTubePage from './pages/youtube';
import DexieAdminPanel from './pages/dexie-admin';
import MayaAssistant from './pages/maya';
import CortexPage from './pages/cortex/CortexPage';

import DexieTestPage from './pages/DexieTestPage';
import KanbanPage from './pages/kanban';
import DriverPage from './pages/driver';
import OrderTrackingPage from './pages/order-tracking';
import CompleteProfile from './pages/login/CompleteProfile';
import GoogleCallback from './pages/auth/GoogleCallback';
import OwnerSettings from './pages/owner-settings';
import IPadMenuEditor from './pages/ipad-menu-editor';
import WizardLayout from './pages/onboarding/components/WizardLayout';
import MenuReviewDashboard from './pages/onboarding/components/MenuReviewDashboard';
import MobileMenuEditor from './pages/mobile-menu-editor';
import IPadInventoryPage from './pages/ipad_inventory/IPadInventoryPage';
import FaceScannerTest from './pages/FaceScannerTest';
import EnrollFace from './pages/EnrollFace';
import VideoCreator from './pages/VideoCreator';
import AdGenerator from './components/marketing/AdGenerator';
import ProfileSettings from './pages/profile-settings';
import AdminFixSuperAdmin from './pages/admin-fix-superadmin';
import SMSDashboard from './components/SMSDashboard';
import HotelDashboard from './pages/hotel/HotelDashboard';
import StaffDashboard from './pages/hotel/StaffDashboard';
import LandingPage from './pages/LandingPage';
import OnboardingWizard from './pages/onboarding/OnboardingWizard';
import LoyaltyManager from './pages/loyalty/LoyaltyManager';
import VerificationPending from './pages/login/VerificationPending';


// Wrapper for AdGenerator to provide props
const AdGeneratorWrapper = () => {
  const { currentUser } = useAuth();
  return (
    <AdGenerator
      businessId={currentUser?.business_id}
      businessName={currentUser?.business?.name || 'העסק שלי'}
      logoUrl={currentUser?.business?.logo_url}
    />
  );
};

const HomeRouteSelector = () => {
  const { currentUser, deviceMode } = useAuth();
  const { authState, employee } = useMayaAuth();
  const isMayaAuthenticated = authState === 'AUTHORIZED' && employee;

  if (currentUser || isMayaAuthenticated) {
    const isLoyaltyOnly = currentUser?.business?.settings?.club_type;
    if (isLoyaltyOnly) {
      return <Navigate to="/loyalty-manager" replace />;
    }
    if (deviceMode === 'kds') return <Navigate to="/kds" replace />;
    if (deviceMode === 'manager') return <Navigate to="/data-manager-interface" replace />;
    if (deviceMode === 'music') return <Navigate to="/music" replace />;
    return <Navigate to="/menu-ordering-interface" replace />;
  }

  return <LandingPage />;
};

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "linear" }
};

const PageTransition = ({ children }) => <>{children}</>;

import LoadingFallback from './components/LoadingFallback';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, deviceMode: stateMode, isLoading } = useAuth();
  const mayaAuth = useMayaAuth();
  const location = useLocation();

  // Use state mode or fallback to localStorage for immediate transitions
  const deviceMode = stateMode || localStorage.getItem('kiosk_mode');

  console.log('🛡️ [ProtectedRoute] Rendering for path:', location.pathname, { deviceMode, currentUser: !!currentUser });

  if (isLoading) {
    console.log('🛡️ [ProtectedRoute] Still loading...');
    return <LoadingFallback message="טוען מערכת..." />;
  }

  // Check if authenticated via Maya Gateway (biometric)
  const isMayaAuthenticated = mayaAuth.authState === 'AUTHORIZED' && mayaAuth.employee;

  // CRITICAL: If no user and not Maya authenticated, redirect to login
  // Also clear any stale deviceMode that might be in localStorage
  if (!currentUser && !isMayaAuthenticated) {
    // Clear stale mode to prevent auto-redirect to POS on next login
    localStorage.removeItem('kiosk_mode');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isSuperAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin' || currentUser?.isSuperAdmin || mayaAuth.employee?.isSuperAdmin;

  // 🛡️ SECURITY GATE LOCKOUT: Check business status for standard accounts
  if (!isSuperAdmin && currentUser?.business_id) {
    const status = currentUser.business?.settings?.status;
    const isLoyaltyOnly = currentUser.business?.settings?.club_type;

    if (status === 'pending_design' && location.pathname !== '/setup') {
      console.log('🛡️ [ProtectedRoute] Business pending design. Redirecting to setup.');
      return <Navigate to={`/setup?business_id=${currentUser.business_id}`} replace />;
    }

    if (status === 'pending_admin_approval' && location.pathname !== '/verification-pending') {
      console.log('🛡️ [ProtectedRoute] Business pending admin approval. Redirecting to verification page.');
      return <Navigate to="/verification-pending" replace />;
    }

    if (status === 'approved') {
      if (isLoyaltyOnly) {
        if (
          location.pathname === '/verification-pending' ||
          location.pathname === '/setup' ||
          location.pathname === '/mode-selection' ||
          location.pathname === '/' ||
          location.pathname === '/menu-ordering-interface'
        ) {
          console.log('🛡️ [ProtectedRoute] Loyalty-only business approved. Redirecting to loyalty-manager.');
          return <Navigate to="/loyalty-manager" replace />;
        }
      } else {
        if (location.pathname === '/verification-pending' || location.pathname === '/setup') {
          console.log('🛡️ [ProtectedRoute] Business approved. Redirecting away from setup/verification.');
          return <Navigate to="/" replace />;
        }
      }
    }
  }

  const isSuperAdminPath = location.pathname.startsWith('/super-admin');

  // 👑 SUPER ADMIN REDIRECT: If super admin lands on root '/', send them to their portal
  // BUT: if they explicitly requested POS (/?new=true or /?editOrderId=...), let them through!
  const searchParams = new URLSearchParams(location.search);
  const isExplicitPOSRequest = searchParams.get('new') === 'true' || searchParams.has('editOrderId');

  if (isSuperAdmin && location.pathname === '/' && !currentUser?.is_impersonating && !isExplicitPOSRequest) {
    console.log('👑 Super Admin on root - Redirecting to Portal');
    return <Navigate to="/super-admin" replace />;
  }

  if (isSuperAdminPath) {
    // Super Admin routes don't need device mode
    return <PageTransition>{children}</PageTransition>;
  }

  // Routes that are accessible from the dashboard without requiring a device mode
  const DEVICE_MODE_EXEMPT = [
    '/cortex',
    '/profile-settings',
    '/maya',
    '/owner-settings',
    '/hotel',
    '/data-manager-interface',
    '/dexie-admin',
    '/loyalty-manager',
    '/setup',
    '/verification-pending'
  ];
  const isDeviceModeExempt = DEVICE_MODE_EXEMPT.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );

  if (isDeviceModeExempt) {
    return <PageTransition>{children}</PageTransition>;
  }

  // User is logged in - check mode
  if (!deviceMode) {
    // Super Admin without device mode should go to their portal, not mode selection
    if (isSuperAdmin && !currentUser?.is_impersonating) {
      // But if they explicitly requested POS, let them through
      if (isExplicitPOSRequest && location.pathname === '/') {
        return <PageTransition>{children}</PageTransition>;
      }
      return <Navigate to="/super-admin" replace />;
    }

    // Allow explicit POS requests even without a saved device mode
    // This handles the race condition where setMode() hasn't updated state yet
    if (isExplicitPOSRequest && location.pathname === '/') {
      return <PageTransition>{children}</PageTransition>;
    }

    // Explicitly check for POS path (/) when no mode is set
    if (location.pathname === '/' || location.pathname === '/menu-ordering-interface') {
      return <Navigate to="/mode-selection" replace />;
    }

    // If no mode selected and not already on selection screen or login, redirect to mode selection
    if (location.pathname !== '/mode-selection' && location.pathname !== '/login') {
      return <Navigate to="/mode-selection" replace />;
    }

    // If on mode selection, allow access
    return children;
  }

  // 🛡️ MODE-BASED ROOT REDIRECT: Ensure root path always reflects the active mode.
  // This prevents users who are 'Managers' from seeing the 'Kiosk' just because they are on '/'

  // 📱 MOBILE GUARD: POS is not designed for phones — force mobile-appropriate mode
  const isMobileDevice = window.innerWidth < 768;
  if (isMobileDevice && deviceMode === 'kiosk') {
    localStorage.removeItem('kiosk_mode');
    return <Navigate to="/mode-selection" replace />;
  }
  // On mobile, if landing on root '/' (POS screen), redirect to mode selection
  if (isMobileDevice && location.pathname === '/') {
    return <Navigate to="/mode-selection" replace />;
  }

  if (location.pathname === '/' && deviceMode && deviceMode !== 'kiosk') {
    // Check if we explicitly want to create an order or edit an order
    const searchParams = new URLSearchParams(location.search);
    const isExplicitPOSRequest = searchParams.get('new') === 'true' || searchParams.has('editOrderId') || searchParams.get('from') === 'kds';

    if (!isExplicitPOSRequest) {
      if (deviceMode === 'kds') return <Navigate to="/kds" replace />;
      if (deviceMode === 'manager') return <Navigate to="/data-manager-interface" replace />;
      if (deviceMode === 'music') return <Navigate to="/music" replace />;
    }
  }


  return <PageTransition>{children}</PageTransition>;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <RouterRoutes location={location}>
      {/* Public Routes */}
      <Route path="/login" element={<PageTransition><LoginGateway /></PageTransition>} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/face-scanner-test" element={<PageTransition><FaceScannerTest /></PageTransition>} />
      <Route path="/admin/enroll-face" element={<PageTransition><EnrollFace /></PageTransition>} />
      <Route path="/setup" element={
        <ProtectedRoute>
          <OnboardingWizard />
        </ProtectedRoute>
      } />
      <Route path="/verification-pending" element={
        <ProtectedRoute>
          <VerificationPending />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={<Navigate to="/login" replace />} />
      <Route path="/manager" element={<Navigate to="/login" replace />} />
      <Route path="/super-admin" element={
        <ProtectedRoute>
          <SuperAdminPortal />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/businesses" element={
        <ProtectedRoute>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/db" element={
        <ProtectedRoute>
          <DatabaseExplorer />
        </ProtectedRoute>
      } />
      <Route path="/super-admin/sms" element={
        <ProtectedRoute>
          <SMSDashboard />
        </ProtectedRoute>
      } />

      {/* Protected Routes */}
      <Route path="/mode-selection" element={
        <ProtectedRoute>
          <PageTransition>
            <HierarchicalDashboard />
          </PageTransition>
        </ProtectedRoute>
      } />

      {/* Legacy mode selection (kept for backward compatibility) */}
      <Route path="/mode-selection-legacy" element={
        <ProtectedRoute>
          <ModeSelectionScreen />
        </ProtectedRoute>
      } />

      <Route path="/" element={<HomeRouteSelector />} />

      {/* Aliases for Menu Interface */}
      <Route path="/menu-ordering-interface" element={
        <ProtectedRoute>
          <MenuOrderingInterface />
        </ProtectedRoute>
      } />

      <Route path="/kds" element={
        <ProtectedRoute>
          <KdsScreen />
        </ProtectedRoute>
      } />

      {/* Aliases for KDS */}
      <Route path="/kitchen-display-system-interface" element={<Navigate to="/kds" replace />} />

      <Route path="/mobile-kds" element={
        <ProtectedRoute>
          <ManagerKDS />
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute>
          <InventoryPage />
        </ProtectedRoute>
      } />

      <Route path="/ipad-inventory-test" element={
        <ProtectedRoute>
          <IPadInventoryPage />
        </ProtectedRoute>
      } />

      <Route path="/prep" element={
        <ProtectedRoute>
          <PrepPage />
        </ProtectedRoute>
      } />

      <Route path="/music" element={
        <ProtectedRoute>
          <MusicPage />
        </ProtectedRoute>
      } />

      <Route path="/youtube" element={
        <ProtectedRoute>
          <YouTubePage />
        </ProtectedRoute>
      } />

      <Route path="/video-creator" element={
        <ProtectedRoute>
          <VideoCreator />
        </ProtectedRoute>
      } />

      <Route path="/ad-generator" element={
        <ProtectedRoute>
          <AdGeneratorWrapper />
        </ProtectedRoute>
      } />

      <Route path="/maya" element={
        <ProtectedRoute>
          <MayaAssistant />
        </ProtectedRoute>
      } />

      <Route path="/cortex" element={
        <ProtectedRoute>
          <CortexPage />
        </ProtectedRoute>
      } />

      <Route path="/profile-settings" element={
        <ProtectedRoute>
          <ProfileSettings />
        </ProtectedRoute>
      } />

      {/* Admin Utility - Fix Super Admin */}
      <Route path="/admin-fix-superadmin" element={<AdminFixSuperAdmin />} />

      <Route path="/data-manager-interface" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <DataManagerInterface />
          </ErrorBoundary>
        </ProtectedRoute>
      } />



      {/* Google Callback Route */}
      <Route path="/auth/callback" element={<GoogleCallback />} />

      {/* Kanban Order System */}
      <Route path="/kanban" element={
        <ProtectedRoute>
          <KanbanPage />
        </ProtectedRoute>
      } />

      <Route path="/driver" element={
        <ProtectedRoute>
          <DriverPage />
        </ProtectedRoute>
      } />

      <Route path="/owner-settings" element={
        <ProtectedRoute>
          <OwnerSettings />
        </ProtectedRoute>
      } />

      <Route path="/onboarding" element={
        <ProtectedRoute>
          <WizardLayout />
        </ProtectedRoute>
      } />

      <Route path="/loyalty-manager" element={
        <ProtectedRoute>
          <LoyaltyManager />
        </ProtectedRoute>
      } />

      <Route path="/menu-editor" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <MobileMenuEditor />
          </ErrorBoundary>
        </ProtectedRoute>
      } />

      {/* Order Tracking - Public (no auth required) */}
      <Route path="/order-tracking/:id" element={<PageTransition><OrderTrackingPage /></PageTransition>} />

      {/* Debug/Internal Tools */}
      <Route path="/dexie-test" element={
        <ProtectedRoute>
          <DexieTestPage />
        </ProtectedRoute>
      } />

      <Route path="/dexie-admin" element={
        <ProtectedRoute>
          <DexieAdminPanel />
        </ProtectedRoute>
      } />

      {/* Hotel POC Routes */}
      <Route path="/hotel/staff" element={
        <ProtectedRoute>
          <StaffDashboard />
        </ProtectedRoute>
      } />
      <Route path="/hotel/admin" element={
        <ProtectedRoute>
          <HotelDashboard />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />

    </RouterRoutes>
  );
};


// Placeholder SDK Construction (for initial Integration)
// In a real implementation, this would be imported from src/sdk/client.ts
const realSDK = {
  auth: { identify: async () => ({ id: 'guest', role: 'staff', access_level: 2, name: 'Guest', business_id: '', permissions: [] }) },
  db: {
    query: async () => ({ data: [], error: null, correlation_id: 'init' }),
    commit: async () => ({ success: true, correlation_id: 'init', timestamp: new Date().toISOString(), rollback_token: 'init' })
  },
  ai: {
    consult: async (prompt, context) => {
      console.log('🖥️ Routing AI Consult to Local Ollama Mesh (DGX Spark)...');
      try {
        const response = await fetch('http://localhost:8081/api/maya/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'system', content: 'You are an intent-parsing engine for Abrakadabra.' }, { role: 'user', content: prompt }],
            businessId: '22222222-2222-2222-2222-222222222222',
            provider: 'local'
          })
        });
        const data = await response.json();
        return { content: data.response, suggestions: [], tokens_used: 0 };
      } catch (err) {
        console.error('AI Consult failed:', err);
        return { content: 'Error connecting to local AI mesh.', suggestions: [], tokens_used: 0 };
      }
    }
  },
  registry: { lookup: async () => null },
  abrakadabra: {
    getManifesto: async () => ({
      spell_id: 'void', incantation: '', effect: '',
      caster: { employee_id: '', role: 'staff', business_id: '' },
      correlation_id: '', timestamp: '',
      target_component: { component_id: '', file_path: '', current_behavior: '', proposed_behavior: '' },
      impact_analysis: { affected_screens: [], affected_supabase_tables: [], affected_dexie_tables: [], affected_rpcs: [], risk_level: 'low' },
      database_requirements: { needs_supabase_migration: false, needs_dexie_version_bump: false, new_rpc_functions: [] },
      security_audit: { rls_affected: false, exposes_financial_data: false, requires_auth_change: false, forbidden_patterns_check: { uses_raw_sql: false, uses_service_role_key: false, bypasses_rls: false, modifies_auth_tables: false } },
      files: { modified: [], created: [] },
      ui_changes: { modifies_layout: false, modifies_styles: false, user_approval_required: false }
    }),
    castSpell: async () => ({
      spell_id: 'void', incantation: '', effect: '',
      caster: { employee_id: '', role: 'staff', business_id: '' },
      correlation_id: '', timestamp: '',
      target_component: { component_id: '', file_path: '', current_behavior: '', proposed_behavior: '' },
      impact_analysis: { affected_screens: [], affected_supabase_tables: [], affected_dexie_tables: [], affected_rpcs: [], risk_level: 'low' },
      database_requirements: { needs_supabase_migration: false, needs_dexie_version_bump: false, new_rpc_functions: [] },
      security_audit: { rls_affected: false, exposes_financial_data: false, requires_auth_change: false, forbidden_patterns_check: { uses_raw_sql: false, uses_service_role_key: false, bypasses_rls: false, modifies_auth_tables: false } },
      files: { modified: [], created: [] },
      ui_changes: { modifies_layout: false, modifies_styles: false, user_approval_required: false }
    }),
    prestoPromote: async () => ({ success: true, correlation_id: 'init', timestamp: '', rollback_token: '' }),
    dispel: async () => ({ success: true, correlation_id: 'init', timestamp: '', rollback_token: '' })
  }
};

import MayaOverlay from "./components/maya/MayaOverlay";

const Routes = () => {
  const Router = isElectron() ? HashRouter : BrowserRouter;

  return (
    <Router>
      <ErrorBoundary>
        <MayaAuthProvider>
          <AuthProvider>
            <AbraHatProvider realSDK={realSDK}>
              <ConnectivityStatus />
              {/* <SyncStatusModal /> - USER REQUESTED TO HIDE THIS MODAL */}
              <ScrollToTop />
              <MayaOverlay />
              <OrderPusher /> {/* 🔄 Added Background Sync inside AuthProvider */}
              <AppRoutes />

              <AbraPreviewDrawer />
              <AbraInspector />
            </AbraHatProvider>
          </AuthProvider>
        </MayaAuthProvider>
      </ErrorBoundary>
    </Router>
  );
};


export default Routes;