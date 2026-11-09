import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import Footer from './components/layout/Footer';
import NavBar from './components/layout/NavBar';
import PageShell from './components/layout/PageShell';
import { useAuth } from './hooks/useAuth';
import Login from './pages/auth/Login';
import Onboarding from './pages/auth/Onboarding';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import Welcome from './pages/auth/Welcome';
import BookDetails from './pages/home/BookDetails';
import Home from './pages/home/Home';
import SearchResults from './pages/home/SearchResults';
import AddBook from './pages/listings/AddBook';
import EditBook from './pages/listings/EditBook';
import MyBooks from './pages/listings/MyBooks';
import { LoadingState } from './pages/PageParts';
import EditProfile from './pages/profile/EditProfile';
import MyProfile from './pages/profile/MyProfile';
import PrivacySettings from './pages/profile/PrivacySettings';
import PublicProfile from './pages/profile/PublicProfile';
import AddWishItem from './pages/wishlist/AddWishItem';
import WishList from './pages/wishlist/WishList';

/** Client-side guard for a nicer flow. The server enforces access on every request. */
function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function GuestOnly() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingState />;
  if (user) return <Navigate to={user.onboardingCompleted ? '/home' : '/onboarding'} replace />;
  return <Outlet />;
}

function WithShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <PageShell>
        <Outlet />
      </PageShell>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      <Route element={<WithShell />}>
        {/* Public browsing */}
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/books/:copyId" element={<BookDetails />} />

        <Route element={<RequireAuth />}>
          <Route path="/books/new" element={<AddBook />} />
          <Route path="/books/:copyId/edit" element={<EditBook />} />
          <Route path="/my-books" element={<MyBooks />} />
          <Route path="/wishlist" element={<WishList />} />
          <Route path="/wishlist/new" element={<AddWishItem />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/profile/privacy" element={<PrivacySettings />} />
          <Route path="/users/:userId" element={<PublicProfile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
