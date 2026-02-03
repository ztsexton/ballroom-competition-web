import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicCompetition } from '../types';
import { publicCompetitionsApi } from '../api/client';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CompetitionCard({ comp, linkPrefix = '/results' }: { comp: PublicCompetition; linkPrefix?: string }) {
  return (
    <Link
      to={`${linkPrefix}/${comp.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        className="card"
        style={{ padding: '1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
        onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
        onMouseOut={(e) => (e.currentTarget.style.boxShadow = '')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600 }}>{comp.name}</div>
          {comp.type && (
            <span style={{
              fontSize: '0.75rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              background: '#ebf4ff',
              color: '#3182ce',
              whiteSpace: 'nowrap',
            }}>
              {comp.type}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.25rem' }}>
          {formatDate(comp.date)}
          {comp.location && <> &middot; {comp.location}</>}
        </div>
        {comp.description && (
          <div style={{ fontSize: '0.85rem', color: '#a0aec0', marginTop: '0.35rem' }}>
            {comp.description}
          </div>
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
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', color: '#2d3748', marginBottom: '0.5rem' }}>
          Ballroom Scorer
        </h1>
        <p style={{ color: '#718096', fontSize: '1.1rem' }}>
          Competition management, scoring, and results for ballroom dance
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#718096' }}>Loading competitions...</div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Upcoming */}
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#2d3748' }}>
              Upcoming Competitions
            </h2>
            {upcoming.length === 0 ? (
              <p style={{ color: '#a0aec0' }}>No upcoming competitions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcoming.map((c) => (
                  <CompetitionCard key={c.id} comp={c} linkPrefix="/competition" />
                ))}
              </div>
            )}
          </div>

          {/* Recent */}
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#2d3748' }}>
              Recent Results
            </h2>
            {recent.length === 0 ? (
              <p style={{ color: '#a0aec0' }}>No recent competitions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
