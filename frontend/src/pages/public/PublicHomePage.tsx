import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicCompetition } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { Skeleton } from '../../components/Skeleton';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CompetitionCard({ comp, linkPrefix = '/results' }: { comp: PublicCompetition; linkPrefix?: string }) {
  return (
    <Link to={`${linkPrefix}/${comp.id}`} className="no-underline text-inherit">
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer transition-shadow hover:shadow-md">
        <div className="flex justify-between items-start gap-2">
          <div className="font-semibold text-gray-800">{comp.name}</div>
          {comp.type && <CompetitionTypeBadge type={comp.type} />}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {formatDate(comp.date)}
          {comp.location && <> &middot; {comp.location}</>}
        </div>
        {comp.description && (
          <div className="text-sm text-gray-400 mt-1">{comp.description}</div>
        )}
      </div>
    </Link>
  );
}

const PublicHomePage = () => {
  const [upcoming, setUpcoming] = useState<PublicCompetition[]>([]);
  const [recent, setRecent] = useState<PublicCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      publicCompetitionsApi.getAll('upcoming'),
      publicCompetitionsApi.getAll('recent'),
    ])
      .then(([u, r]) => {
        setUpcoming(u.data.slice(0, 10));
        setRecent(r.data.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Ballroom Scorer</h1>
        <p className="text-gray-500 text-lg">
          Competition management, scoring, and results for ballroom dance
        </p>
      </div>

      {loading ? (
        <div className="flex gap-8 flex-wrap">
          <div className="flex-1 min-w-[320px]">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
            </div>
          </div>
          <div className="flex-1 min-w-[320px]">
            <Skeleton className="h-6 w-36 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-8 flex-wrap">
          {/* Upcoming */}
          <div className="flex-1 min-w-[320px]">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Upcoming Competitions</h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-400">No upcoming competitions.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((c) => (
                  <CompetitionCard key={c.id} comp={c} linkPrefix="/competition" />
                ))}
              </div>
            )}
          </div>

          {/* Recent */}
          <div className="flex-1 min-w-[320px]">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Results</h2>
            {recent.length === 0 ? (
              <p className="text-gray-400">No recent competitions.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recent.map((c) => (
                  <CompetitionCard key={c.id} comp={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicHomePage;
