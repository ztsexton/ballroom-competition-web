import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-white no-underline px-2 py-1 rounded text-[0.95rem] transition-colors ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`;

const PublicLayout = () => {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="bg-primary-500 px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <Link to="/" className="text-white no-underline font-bold text-xl mr-4">
            Ballroom Scorer
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex gap-3 flex-1">
            <NavLink to="/results" className={linkClass}>Results</NavLink>
            <NavLink to="/pricing" className={linkClass}>Pricing</NavLink>
            <NavLink to="/faq" className={linkClass}>FAQ</NavLink>
          </div>

          <div className="hidden md:block">
            {!loading && user ? (
              <Link to="/dashboard" className="text-primary-500 bg-white no-underline px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-100 transition-colors">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="text-primary-500 bg-white no-underline px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-100 transition-colors">
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden ml-auto bg-transparent border-none text-white cursor-pointer p-1"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden mt-3 flex flex-col gap-2 border-t border-white/20 pt-3">
            <NavLink to="/results" className={linkClass} onClick={() => setMenuOpen(false)}>Results</NavLink>
            <NavLink to="/pricing" className={linkClass} onClick={() => setMenuOpen(false)}>Pricing</NavLink>
            <NavLink to="/faq" className={linkClass} onClick={() => setMenuOpen(false)}>FAQ</NavLink>
            {!loading && user ? (
              <Link to="/dashboard" className="text-primary-500 bg-white no-underline px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-100 transition-colors w-fit" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="text-primary-500 bg-white no-underline px-4 py-1.5 rounded text-sm font-semibold hover:bg-gray-100 transition-colors w-fit" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>
      <Outlet />
    </>
  );
};

export default PublicLayout;
