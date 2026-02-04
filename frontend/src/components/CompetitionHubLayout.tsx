import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useParams } from 'react-router-dom';
import { competitionsApi } from '../api/client';
import { useCompetition } from '../context/CompetitionContext';
import { Competition } from '../types';

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

  if (loading) return <div className="loading">Loading...</div>;

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <p style={{ color: '#e53e3e' }}>{error}</p>
          <Link to="/competitions" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            Back to Competitions
          </Link>
        </div>
      </div>
    );
  }

  const competitionName = activeCompetition?.name || 'Competition';

  return (
    <div>
      {/* Breadcrumb + Tab bar in a constrained header area */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#718096' }}>
          <Link to="/competitions" style={{ color: '#667eea', textDecoration: 'none' }}>
            Competitions
          </Link>
          <span style={{ margin: '0 0.5rem' }}>/</span>
          <span style={{ color: '#2d3748', fontWeight: 500 }}>{competitionName}</span>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '0',
          gap: '0.25rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          {TABS.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              style={({ isActive }) => ({
                padding: '0.75rem 1.25rem',
                color: isActive ? '#667eea' : '#4a5568',
                textDecoration: 'none',
                borderBottom: isActive ? '3px solid #667eea' : '3px solid transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.9375rem',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: '-2px',
              })}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Tab content — child pages provide their own container */}
      <Outlet />
    </div>
  );
};

export default CompetitionHubLayout;
