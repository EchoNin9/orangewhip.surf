import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';

/* ── Eager-loaded feature pages (core navigation) ── */
import { HomePage } from '@/features/home/HomePage';
import { UpdatesPage } from '@/features/updates/UpdatesPage';
import { PressPage } from '@/features/press/PressPage';
import { PressDetailPage } from '@/features/press/PressDetailPage';
import { AuthPage } from '@/features/auth/AuthPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { PublicProfilePage } from '@/features/profile/PublicProfilePage';

/* ── Lazy-loaded feature pages ── */
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
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>

      <Footer />
    </div>
  );
}
