import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { user, loading, login, error } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user && !loading) {
      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, searchParams]);

  const handleLogin = async () => {
    await login();
  };

  if (!loading && user) {
    return null;
  }

  return (
    <div className="container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh'
    }}>
      <div className="card" style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '0.5rem', color: '#667eea' }}>
          Ballroom Scorer
        </h1>
        <p style={{ marginBottom: '2rem', color: '#718096' }}>
          Sign in to manage your ballroom dance competitions
        </p>

        <button
          onClick={handleLogin}
          className="btn"
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5568d3'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
        >
          🔐 Sign in with Google
        </button>

        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fed7d7',
            color: '#c53030',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <p style={{
          marginTop: '2rem',
          fontSize: '0.85rem',
          color: '#a0aec0'
        }}>
          Secure authentication powered by Google
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
