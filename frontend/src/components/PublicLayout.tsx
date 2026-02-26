import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      <nav className="bg-primary-500 px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap">
          <Link to="/" className="text-white no-underline font-bold text-xl mr-4">
            Ballroom Scorer
          </Link>

          <div className="flex gap-3 flex-1">
            <Link
              to="/results"
              className={`text-white no-underline px-2 py-1 rounded text-[0.95rem] transition-colors ${isActive('/results') ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              Results
            </Link>
            <Link
              to="/pricing"
              className={`text-white no-underline px-2 py-1 rounded text-[0.95rem] transition-colors ${isActive('/pricing') ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              Pricing
            </Link>
            <Link
              to="/faq"
              className={`text-white no-underline px-2 py-1 rounded text-[0.95rem] transition-colors ${isActive('/faq') ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              FAQ
            </Link>
          </div>

          <div>
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
        </div>
      </nav>
      <Outlet />
    </>
  );
};

export default PublicLayout;
