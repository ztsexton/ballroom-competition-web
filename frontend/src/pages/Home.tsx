import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { competitionsApi } from '../api/client';
import { Competition } from '../types';

const typeColors: Record<string, { bg: string; text: string }> = {
  NDCA: { bg: '#e9d8fd', text: '#553c9a' },
  USA_DANCE: { bg: '#bee3f8', text: '#2a4365' },
  STUDIO: { bg: '#fefcbf', text: '#744210' },
  UNAFFILIATED: { bg: '#e2e8f0', text: '#4a5568' },
};

const Home = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    competitionsApi.getAll()
      .then(res => setCompetitions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const sorted = [...competitions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>Ballroom Scorer</h2>
        <p style={{ color: '#718096' }}>
          Manage competitions, entries, events, scheduling, and scoring.
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Link to="/competitions" className="btn">
          + New Competition
        </Link>
        <Link to="/competitions" className="btn btn-secondary">
          View All Competitions
        </Link>
      </div>

      {/* Competitions List */}
      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3 style={{ color: '#718096', marginBottom: '0.5rem' }}>No competitions yet</h3>
          <p style={{ color: '#a0aec0' }}>Create your first competition to get started.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ marginBottom: '0.75rem', color: '#4a5568' }}>
            Competitions ({sorted.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sorted.map(comp => {
              const colors = typeColors[comp.type] || typeColors.UNAFFILIATED;
              return (
                <Link
                  key={comp.id}
                  to={`/competitions/${comp.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1.0625rem', marginBottom: '0.25rem' }}>
                      {comp.name}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.875rem', color: '#718096' }}>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: colors.bg,
                        color: colors.text,
                      }}>
                        {comp.type.replace('_', ' ')}
                      </span>
                      <span>{new Date(comp.date).toLocaleDateString()}</span>
                      {comp.location && <span>{comp.location}</span>}
                    </div>
                  </div>
                  <span style={{ color: '#667eea', fontSize: '1rem', fontWeight: 600 }}>
                    Manage &rsaquo;
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
