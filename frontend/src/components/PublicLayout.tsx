import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkStyle = (path: string) => ({
    color: 'white',
    textDecoration: 'none',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.95rem',
    background: isActive(path) ? 'rgba(255,255,255,0.15)' : 'transparent',
  });

  return (
    <>
      <nav style={{
        background: '#667eea',
        padding: '0.75rem 1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <Link to="/" style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            marginRight: '1rem',
          }}>
            Ballroom Scorer
          </Link>

          <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
            <Link to="/results" style={linkStyle('/results')}>Results</Link>
            <Link to="/pricing" style={linkStyle('/pricing')}>Pricing</Link>
            <Link to="/faq" style={linkStyle('/faq')}>FAQ</Link>
          </div>

          <div>
            {!loading && user ? (
              <Link to="/dashboard" style={{
                color: '#667eea',
                background: 'white',
                textDecoration: 'none',
                padding: '0.375rem 1rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}>
                Dashboard
              </Link>
            ) : (
              <Link to="/login" style={{
                color: '#667eea',
                background: 'white',
                textDecoration: 'none',
                padding: '0.375rem 1rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}>
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
