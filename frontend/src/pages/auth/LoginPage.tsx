import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { databaseApi } from '../../api/client';

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
  const [bypassLoading, setBypassLoading] = useState(false);
  const [stagingAllowed, setStagingAllowed] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, searchParams]);

  // Check if staging mode is allowed on this server
  useEffect(() => {
    databaseApi.getStagingBypass()
      .then(res => setStagingAllowed(res.data.allowed))
      .catch(() => {}); // Not available = not allowed
  }, []);

  const handleLogin = async () => {
    await login();
  };

  const handleStagingBypass = async () => {
    setBypassLoading(true);
    try {
      await databaseApi.setStagingBypass(true);
      // Reload the page so AuthContext picks up the new state
      window.location.reload();
    } catch {
      setBypassLoading(false);
    }
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

        {/* Staging bypass — only shown when STAGING_MODE_ALLOWED is set on the server */}
        {stagingAllowed && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleStagingBypass}
              disabled={bypassLoading}
              className="text-xs text-gray-400 hover:text-amber-600 transition-colors bg-transparent border-none cursor-pointer disabled:opacity-50"
            >
              {bypassLoading ? 'Enabling...' : 'Enter staging mode (skip auth)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
