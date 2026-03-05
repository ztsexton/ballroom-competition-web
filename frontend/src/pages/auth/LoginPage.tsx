import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function friendlyError(error: string): string {
  if (error.includes('popup-closed')) return 'Sign-in was cancelled. Please try again.';
  if (error.includes('network-request-failed')) return 'Network error. Please check your connection.';
  if (error.includes('popup-blocked')) return 'Pop-up blocked. Please allow pop-ups for this site.';
  return error;
}

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
    <div className="flex justify-center items-center min-h-screen px-4">
      <div className="bg-white rounded-lg shadow-lg max-w-[500px] w-full text-center p-8">
        <h1 className="text-2xl font-bold text-primary-500 mb-2">
          Ballroom Scorer
        </h1>
        <p className="text-gray-500 mb-8">
          Sign in to manage your ballroom dance competitions
        </p>

        <button
          onClick={handleLogin}
          className="w-full py-3 px-6 bg-primary-500 text-white border-none rounded-md cursor-pointer text-base font-medium transition-colors hover:bg-primary-600"
        >
          Sign in with Google
        </button>

        {error && (
          <div className="mt-4 px-3 py-3 bg-red-100 text-red-700 rounded text-sm">
            {friendlyError(error)}
          </div>
        )}

        <p className="mt-8 text-sm text-gray-400">
          Secure authentication powered by Google
        </p>

        <Link to="/" className="inline-block mt-4 text-sm text-primary-500 no-underline hover:underline">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
