import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { competitionsApi } from '../../api/client';
import { Competition } from '../../types';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { Skeleton } from '../../components/Skeleton';

const AdminDashboardPage = () => {
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAnyAdmin) {
      setLoading(false);
      return;
    }
    competitionsApi.getAll()
      .then(res => setCompetitions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAnyAdmin]);

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to access this page.</p>
        </div>
      </div>
    );
  }

  const sorted = [...competitions].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Admin Dashboard</h2>
        <p className="text-gray-500">
          Manage competitions and site settings.
        </p>
      </div>

      {/* Site Administration — only for full site admins */}
      {isAdmin && (
        <div className="mb-6">
          <h3 className="text-gray-600 font-semibold mb-3">Site Administration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/users"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Users</div>
              <p className="text-sm text-gray-500 m-0">Manage user accounts and admin access</p>
            </Link>
            <Link
              to="/studios"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Studios</div>
              <p className="text-sm text-gray-500 m-0">Manage dance studios and MindBody integrations</p>
            </Link>
            <Link
              to="/organizations"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Organizations</div>
              <p className="text-sm text-gray-500 m-0">Manage competition organizations and rule presets</p>
            </Link>
          </div>
        </div>
      )}

      {/* Competitions */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-600 font-semibold">
            Competitions ({sorted.length})
          </h3>
          {isAdmin && (
            <Link
              to="/competitions"
              className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              + New Competition
            </Link>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12 px-6">
            <h3 className="text-gray-500 mb-2">No competitions</h3>
            <p className="text-gray-400">
              {isAdmin ? 'Create your first competition to get started.' : 'You have not been assigned to any competitions yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(comp => (
              <Link
                key={comp.id}
                to={`/competitions/${comp.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-white rounded-lg shadow no-underline text-inherit transition-shadow hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-[1.0625rem] mb-1">
                    {comp.name}
                  </div>
                  <div className="flex gap-3 items-center text-sm text-gray-500">
                    <CompetitionTypeBadge type={comp.type} />
                    <span>{new Date(comp.date).toLocaleDateString()}</span>
                    {comp.location && <span>{comp.location}</span>}
                  </div>
                </div>
                <span className="text-primary-500 font-semibold">
                  Manage &rsaquo;
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
