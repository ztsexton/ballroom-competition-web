import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-white no-underline px-2 py-1 rounded transition-colors ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`;

const Navigation = () => {
  const { user, isAnyAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-primary-500 p-4 mb-8 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center gap-8">
        <NavLink to="/dashboard" className="text-white font-bold text-xl no-underline">
          Ballroom Scorer
        </NavLink>

        {/* Desktop links */}
        <div className="hidden md:flex gap-4 flex-1">
          {isAnyAdmin && (
            <NavLink to="/competitions" className={linkClass}>Competitions</NavLink>
          )}
          <NavLink to="/portal" className={linkClass}>My Portal</NavLink>
          {isAnyAdmin && (
            <NavLink to="/admin" className={linkClass}>Admin</NavLink>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user && (
            <NavLink to="/profile" className="text-white text-sm no-underline hover:text-white/80 transition-colors">
              {user.displayName || user.email}
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded border-none bg-white/20 text-white text-sm font-medium cursor-pointer transition-colors hover:bg-white/30"
          >
            Logout
          </button>
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
          {isAnyAdmin && (
            <NavLink to="/competitions" className={linkClass} onClick={() => setMenuOpen(false)}>Competitions</NavLink>
          )}
          <NavLink to="/portal" className={linkClass} onClick={() => setMenuOpen(false)}>My Portal</NavLink>
          {isAnyAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={() => setMenuOpen(false)}>Admin</NavLink>
          )}
          {user && (
            <NavLink to="/profile" className="text-white/80 text-sm no-underline px-2 py-1" onClick={() => setMenuOpen(false)}>
              {user.displayName || user.email}
            </NavLink>
          )}
          <button
            onClick={() => { setMenuOpen(false); handleLogout(); }}
            className="text-left px-2 py-1 rounded border-none bg-white/20 text-white text-sm font-medium cursor-pointer transition-colors hover:bg-white/30"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
