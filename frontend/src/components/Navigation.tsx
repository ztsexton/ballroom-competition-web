import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const { user, isAnyAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-primary-500 p-4 mb-8 shadow-md">
      <div className="max-w-7xl mx-auto flex gap-8 items-center flex-wrap">
        <Link to="/dashboard" className="text-white font-bold text-xl no-underline">
          Ballroom Scorer
        </Link>
        <div className="flex gap-6 flex-1 flex-wrap">
          {isAnyAdmin && (
            <Link to="/competitions" className="text-white no-underline hover:text-white/80 transition-colors">Competitions</Link>
          )}
          <Link to="/portal" className="text-white no-underline hover:text-white/80 transition-colors">My Portal</Link>
          {isAnyAdmin && (
            <Link to="/admin" className="text-white no-underline hover:text-white/80 transition-colors">Admin</Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <Link to="/profile" className="text-white text-sm no-underline hover:text-white/80 transition-colors">
              {user.displayName || user.email}
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded border-none bg-white/20 text-white text-sm font-medium cursor-pointer transition-colors hover:bg-white/30"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
