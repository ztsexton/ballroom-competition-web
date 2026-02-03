import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav style={{
      background: '#667eea',
      padding: '1rem',
      marginBottom: '2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <Link to="/dashboard" style={{
          color: 'white',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          textDecoration: 'none'
        }}>
          Ballroom Scorer
        </Link>
        <div style={{ display: 'flex', gap: '1.5rem', flex: 1, flexWrap: 'wrap' }}>
          {isAdmin ? (
            <>
              <Link to="/competitions" style={{ color: 'white' }}>Competitions</Link>
              <Link to="/studios" style={{ color: 'white' }}>Studios</Link>
              <Link to="/organizations" style={{ color: 'white' }}>Organizations</Link>
              <Link to="/users" style={{ color: 'white' }}>Users</Link>
            </>
          ) : (
            <Link to="/portal" style={{ color: 'white' }}>My Portal</Link>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user && (
            <Link to="/profile" style={{ color: 'white', fontSize: '0.875rem', textDecoration: 'none' }}>
              {user.displayName || user.email}
            </Link>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
