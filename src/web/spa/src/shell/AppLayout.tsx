import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';

/* ── Eager-loaded: homepage only ── */
import { HomePage } from '@/features/home/HomePage';

/* ── Lazy-loaded feature pages ── */
const UpdatesPage = lazy(() => import('@/features/updates/UpdatesPage').then(m => ({ default: m.UpdatesPage })));
const PressPage = lazy(() => import('@/features/press/PressPage').then(m => ({ default: m.PressPage })));
const PressDetailPage = lazy(() => import('@/features/press/PressDetailPage').then(m => ({ default: m.PressDetailPage })));
const AuthPage = lazy(() => import('@/features/auth/AuthPage').then(m => ({ default: m.AuthPage })));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const PublicProfilePage = lazy(() => import('@/features/profile/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })));
const ShowsPage = lazy(() => import('@/features/shows/ShowsPage'));
const ShowDetailPage = lazy(() => import('@/features/shows/ShowDetailPage'));
const MediaPage = lazy(() => import('@/features/media/MediaPage'));
const MediaDetailPage = lazy(() => import('@/features/media/MediaDetailPage'));

/* ── Lazy-loaded admin pages ── */
const AdminDashboard = lazy(() => import('@/features/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ShowsAdminPage = lazy(() => import('@/features/admin/ShowsAdminPage'));
const VenuesAdminPage = lazy(() => import('@/features/admin/VenuesAdminPage'));
const MediaAdminPage = lazy(() => import('@/features/admin/MediaAdminPage'));
const UpdatesAdminPage = lazy(() => import('@/features/admin/UpdatesAdminPage').then(m => ({ default: m.UpdatesAdminPage })));
const PressAdminPage = lazy(() => import('@/features/admin/PressAdminPage').then(m => ({ default: m.PressAdminPage })));
const MembershipPage = lazy(() => import('@/features/admin/MembershipPage').then(m => ({ default: m.MembershipPage })));
const UsersPage = lazy(() => import('@/features/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const ApiKeysPage = lazy(() => import('@/features/admin/ApiKeysPage').then(m => ({ default: m.ApiKeysPage })));
const BrandingAdminPage = lazy(() => import('@/features/admin/BrandingAdminPage').then(m => ({ default: m.BrandingAdminPage })));

/** Route loading fallback */
function PageLoader() {
  return (
    <div className="container-max section-padding flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-secondary-900">
      <Header />

      <div className="flex-1">
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<HomePage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/press" element={<PressPage />} />
            <Route path="/press/:id" element={<PressDetailPage />} />
            <Route path="/login" element={<AuthPage />} />

            {/* Public shows */}
            <Route path="/shows" element={<ShowsPage />} />
            <Route path="/shows/:id" element={<ShowDetailPage />} />

            {/* Public media */}
            <Route path="/media" element={<MediaPage />} />
            <Route path="/media/:id" element={<MediaDetailPage />} />

            {/* Authenticated */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:identifier" element={<PublicProfilePage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/shows" element={<ShowsAdminPage />} />
            <Route path="/admin/venues" element={<VenuesAdminPage />} />
            <Route path="/admin/media" element={<MediaAdminPage />} />
            <Route path="/admin/updates" element={<UpdatesAdminPage />} />
            <Route path="/admin/press" element={<PressAdminPage />} />
            <Route path="/admin/membership" element={<MembershipPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/api-keys" element={<ApiKeysPage />} />
            <Route path="/admin/branding" element={<BrandingAdminPage />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>

      <Footer />
    </div>
  );
}
