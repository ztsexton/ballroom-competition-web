import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { competitionsApi, databaseApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCompetition } from '../context/CompetitionContext';
import { Competition } from '../types';
import { CompetitionTypeBadge } from '../components/CompetitionTypeBadge';
import { Skeleton } from '../components/Skeleton';

const Home = () => {
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const { refreshCompetitions } = useCompetition();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSeedTestCompetition = async () => {
    if (!confirm('This will create a test competition "Galaxy Ballroom Classic 2026" with sample data. Continue?')) {
      return;
    }

    setSeeding(true);
    setSeedMessage(null);

    try {
      const res = await databaseApi.seed();
      setSeedMessage({ type: 'success', text: res.data.message });
      const compsRes = await competitionsApi.getAll();
      setCompetitions(compsRes.data);
      await refreshCompetitions();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const message = axiosErr.response?.data?.message || axiosErr.message || 'Failed to create test competition';
      setSeedMessage({ type: 'error', text: message });
    } finally {
      setSeeding(false);
    }
  };

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
        <div className="flex gap-3 mb-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!isAnyAdmin) return <Navigate to="/portal" replace />;

  const query = search.toLowerCase().trim();
  const filtered = competitions.filter(c =>
    !query ||
    c.name.toLowerCase().includes(query) ||
    c.location?.toLowerCase().includes(query) ||
    c.type.replace('_', ' ').toLowerCase().includes(query)
  );

  const sorted = [...filtered].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Ballroom Scorer</h2>
        <p className="text-gray-500">
          Manage competitions, participants, events, scheduling, and scoring.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Link to="/competitions" className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors">
          + New Competition
        </Link>
        <Link to="/competitions" className="inline-block px-4 py-2 bg-gray-500 text-white rounded no-underline text-sm font-medium hover:bg-gray-600 transition-colors">
          View All Competitions
        </Link>
      </div>

      {/* Search + Competitions List */}
      <div>
        <div className="flex justify-between items-center mb-3 gap-4 flex-wrap">
          <h3 className="text-gray-600 font-semibold">
            Competitions ({sorted.length})
          </h3>
          {competitions.length > 0 && (
            <input
              type="text"
              placeholder="Search competitions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm w-60 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12 px-6">
            <h3 className="text-gray-500 mb-2">
              {query ? 'No matching competitions' : 'No competitions yet'}
            </h3>
            <p className="text-gray-400">
              {query ? 'Try a different search term.' : 'Create your first competition to get started.'}
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

      {/* Developer Tools (site admin only) */}
      {isAdmin && <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-gray-600 font-semibold mb-3">Developer Tools</h3>
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-gray-800 mb-1">Create Test Competition</div>
            <p className="text-sm text-gray-500">
              Seed "Galaxy Ballroom Classic 2026" with sample studios, people, couples, events, and entries for demos and testing.
            </p>
          </div>
          <button
            onClick={handleSeedTestCompetition}
            disabled={seeding}
            className={`px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium whitespace-nowrap transition-colors hover:bg-primary-600 ${seeding ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {seeding ? 'Creating...' : 'Create Test Competition'}
          </button>
        </div>
        {seedMessage && (
          <div className={`mt-3 px-4 py-3 rounded-md text-sm ${
            seedMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}>
            {seedMessage.text}
          </div>
        )}
      </div>}
    </div>
  );
};

export default Home;
