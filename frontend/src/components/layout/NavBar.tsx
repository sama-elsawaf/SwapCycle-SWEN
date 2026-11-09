import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-full px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep ' +
  (isActive ? 'bg-pink-light text-navy-deep' : 'text-navy hover:bg-pink-light');

export default function NavBar() {
  const { user } = useAuth();

  return (
    <header className="border-b border-soft bg-white">
      <nav aria-label="Main" className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3">
        <Link
          to="/home"
          className="mr-auto rounded font-display text-2xl font-bold text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
        >
          SwapCycle
        </Link>
        <NavLink to="/search" className={linkClass}>
          Search
        </NavLink>
        {user ? (
          <>
            <NavLink to="/my-books" className={linkClass}>
              My books
            </NavLink>
            <NavLink to="/wishlist" className={linkClass}>
              Wish list
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              {user.displayName}
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/login" className={linkClass}>
              Log in
            </NavLink>
            <NavLink to="/register" className={linkClass}>
              Sign up
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
