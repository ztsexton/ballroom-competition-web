import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { competitionsApi, databaseApi, publicCompetitionsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCompetition } from '../context/CompetitionContext';
import { Competition, PublicCompetition } from '../types';
import { CompetitionTypeBadge } from '../components/CompetitionTypeBadge';
import { Skeleton } from '../components/Skeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';

const Home = () => {
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const { refreshCompetitions } = useCompetition();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seedingFinished, setSeedingFinished] = useState(false);
  const [seedFinishedMessage, setSeedFinishedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seedingValidation, setSeedingValidation] = useState(false);
  const [seedValidationMessage, setSeedValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recentResults, setRecentResults] = useState<PublicCompetition[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{title: string; message: string; action: () => void} | null>(null);

  const handleSeedTestCompetition = () => {
    setConfirmAction({
      title: 'Create Test Competition',
      message: 'This will create a test competition "Galaxy Ballroom Classic 2026" with sample data. Continue?',
      action: async () => {
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
      },
    });
  };

  const handleSeedFinishedCompetition = () => {
    setConfirmAction({
      title: 'Create Finished Competition',
      message: 'This will create a fully scored "Stardust Invitational 2026" with results for all events. This may take a moment. Continue?',
      action: async () => {
        setSeedingFinished(true);
        setSeedFinishedMessage(null);

        try {
          const res = await databaseApi.seedFinished();
          setSeedFinishedMessage({ type: 'success', text: res.data.message });
          const compsRes = await competitionsApi.getAll();
          setCompetitions(compsRes.data);
          await refreshCompetitions();
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
          const message = axiosErr.response?.data?.message || axiosErr.message || 'Failed to create finished competition';
          setSeedFinishedMessage({ type: 'error', text: message });
        } finally {
          setSeedingFinished(false);
        }
      },
    });
  };

  const handleSeedValidationCompetition = () => {
    setConfirmAction({
      title: 'Create Validation Demo',
      message: 'This will create a "Level Validation Demo" competition with entry validation enabled, detailed sub-levels, and deliberate validation issues to fix. Continue?',
      action: async () => {
        setSeedingValidation(true);
        setSeedValidationMessage(null);

        try {
          const res = await databaseApi.seedValidation();
          setSeedValidationMessage({ type: 'success', text: res.data.message });
          const compsRes = await competitionsApi.getAll();
          setCompetitions(compsRes.data);
          await refreshCompetitions();
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
          const message = axiosErr.response?.data?.message || axiosErr.message || 'Failed to create validation competition';
          setSeedValidationMessage({ type: 'error', text: message });
        } finally {
          setSeedingValidation(false);
        }
      },
    });
  };

  useEffect(() => {
    if (!isAnyAdmin) {
      setLoading(false);
      setRecentLoading(false);
      return;
    }
    competitionsApi.getAll()
      .then(res => setCompetitions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    publicCompetitionsApi.getAll('recent')
      .then(res => setRecentResults(res.data.slice(0, 5)))
      .catch(() => {})
      .finally(() => setRecentLoading(false));
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

      {/* Recent Results */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-gray-600 font-semibold mb-3">Recent Results</h3>
        {recentLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} variant="card" />)}
          </div>
        ) : recentResults.length === 0 ? (
          <p className="text-gray-400 text-sm">No recent competition results.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentResults.map(comp => (
              <Link
                key={comp.id}
                to={`/results/${comp.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-white rounded-lg shadow no-underline text-inherit transition-shadow hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 mb-1">{comp.name}</div>
                  <div className="flex gap-3 items-center text-sm text-gray-500">
                    <CompetitionTypeBadge type={comp.type} />
                    <span>{new Date(comp.date).toLocaleDateString()}</span>
                    {comp.location && <span>{comp.location}</span>}
                  </div>
                </div>
                <span className="text-primary-500 font-semibold">
                  Results &rsaquo;
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
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4 flex-wrap mt-3">
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-gray-800 mb-1">Create Finished Competition</div>
            <p className="text-sm text-gray-500">
              Seed "Stardust Invitational 2026" with all events fully scored, schedule completed, and results calculated. Covers standard, multi-dance, proficiency, scratches, and tie-breaking scenarios.
            </p>
          </div>
          <button
            onClick={handleSeedFinishedCompetition}
            disabled={seedingFinished}
            className={`px-4 py-2 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium whitespace-nowrap transition-colors hover:bg-success-600 ${seedingFinished ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {seedingFinished ? 'Creating & Scoring...' : 'Create Finished Competition'}
          </button>
        </div>
        {seedFinishedMessage && (
          <div className={`mt-3 px-4 py-3 rounded-md text-sm ${
            seedFinishedMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}>
            {seedFinishedMessage.text}
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4 flex-wrap mt-3">
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-gray-800 mb-1">Create Validation Demo</div>
            <p className="text-sm text-gray-500">
              Seed a competition with entry validation enabled, detailed sub-levels (Bronze 1-4, Silver 1-3), and deliberate validation issues for admin testing.
            </p>
          </div>
          <button
            onClick={handleSeedValidationCompetition}
            disabled={seedingValidation}
            className={`px-4 py-2 bg-amber-500 text-white rounded border-none cursor-pointer text-sm font-medium whitespace-nowrap transition-colors hover:bg-amber-600 ${seedingValidation ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {seedingValidation ? 'Creating...' : 'Create Validation Demo'}
          </button>
        </div>
        {seedValidationMessage && (
          <div className={`mt-3 px-4 py-3 rounded-md text-sm ${
            seedValidationMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}>
            {seedValidationMessage.text}
          </div>
        )}
      </div>}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default Home;
