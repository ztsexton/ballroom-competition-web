import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useParams } from 'react-router-dom';
import { competitionsApi } from '../api/client';
import { useCompetition } from '../context/CompetitionContext';
import { Competition } from '../types';
import { Skeleton } from './Skeleton';

const TABS = [
  { label: 'Overview', path: '', end: true },
  { label: 'Participants', path: 'participants', end: false },
  { label: 'Events', path: 'events', end: false },
  { label: 'Invoices', path: 'invoices', end: false },
  { label: 'Settings', path: 'settings', end: false },
  { label: 'Heat Lists', path: 'heat-lists', end: false },
  { label: 'Run', path: 'run', end: false },
  { label: 'Scrutineer', path: 'scrutineer', end: false },
  { label: 'Day-Of', path: 'day-of', end: false },
];

const CompetitionHubLayout = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const { activeCompetition, setActiveCompetition } = useCompetition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!competitionId) return;
    if (activeCompetition?.id === competitionId) return;

    setLoading(true);
    competitionsApi.getById(competitionId)
      .then(res => {
        setActiveCompetition(res.data as Competition);
        setError('');
      })
      .catch(() => setError('Failed to load competition.'))
      .finally(() => setLoading(false));
  }, [competitionId, activeCompetition?.id, setActiveCompetition]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-6">
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="flex gap-4 mb-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-danger-500">{error}</p>
          <Link to="/competitions" className="inline-block mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors no-underline">
            Back to Competitions
          </Link>
        </div>
      </div>
    );
  }

  const competitionName = activeCompetition?.name || 'Competition';

  return (
    <div>
      <div className="max-w-7xl mx-auto px-8">
        {/* Breadcrumb */}
        <div className="mb-3 text-sm text-gray-500">
          <Link to="/competitions" className="text-primary-500 no-underline hover:underline">
            Competitions
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 font-medium">{competitionName}</span>
        </div>

        {/* Tab bar */}
        <div className="flex border-b-2 border-gray-200 gap-1 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) =>
                `px-5 py-3 no-underline whitespace-nowrap text-[0.9375rem] transition-colors -mb-[2px] ${
                  isActive
                    ? 'text-primary-500 border-b-[3px] border-primary-500 font-semibold'
                    : 'text-gray-600 border-b-[3px] border-transparent font-medium hover:text-primary-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <Outlet />
    </div>
  );
};

export default CompetitionHubLayout;
