import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { competitionsApi, databaseApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCompetition } from '../context/CompetitionContext';
import { Competition } from '../types';

const typeColors: Record<string, { bg: string; text: string }> = {
  NDCA: { bg: '#e9d8fd', text: '#553c9a' },
  USA_DANCE: { bg: '#bee3f8', text: '#2a4365' },
  WDC: { bg: '#d1fae5', text: '#059669' },
  WDSF: { bg: '#fef3c7', text: '#d97706' },
  STUDIO: { bg: '#fefcbf', text: '#744210' },
  UNAFFILIATED: { bg: '#e2e8f0', text: '#4a5568' },
};

const Home = () => {
  const { isAdmin, loading: authLoading } = useAuth();
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
      // Refresh both local list and global CompetitionContext
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
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    competitionsApi.getAll()
      .then(res => setCompetitions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  // Non-admins get redirected to participant portal
  if (!isAdmin) return <Navigate to="/portal" replace />;

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
    <div className="container">
      <div className="card">
        <h2 style={{ marginBottom: '0.5rem' }}>Ballroom Scorer</h2>
        <p style={{ color: '#718096' }}>
          Manage competitions, participants, events, scheduling, and scoring.
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

      {/* Search + Competitions List */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <h3 style={{ margin: 0, color: '#4a5568' }}>
            Competitions ({sorted.length})
          </h3>
          {competitions.length > 0 && (
            <input
              type="text"
              placeholder="Search competitions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.875rem',
                width: '240px',
                outline: 'none',
              }}
            />
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h3 style={{ color: '#718096', marginBottom: '0.5rem' }}>
              {query ? 'No matching competitions' : 'No competitions yet'}
            </h3>
            <p style={{ color: '#a0aec0' }}>
              {query ? 'Try a different search term.' : 'Create your first competition to get started.'}
            </p>
          </div>
        ) : (
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
        )}
      </div>

      {/* Developer Tools */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#4a5568' }}>Developer Tools</h3>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Create Test Competition</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#718096' }}>
              Seed "Galaxy Ballroom Classic 2026" with sample studios, people, couples, events, and entries for demos and testing.
            </p>
          </div>
          <button
            className="btn"
            onClick={handleSeedTestCompetition}
            disabled={seeding}
            style={{ whiteSpace: 'nowrap' }}
          >
            {seeding ? 'Creating...' : 'Create Test Competition'}
          </button>
        </div>
        {seedMessage && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            background: seedMessage.type === 'success' ? '#c6f6d5' : '#fed7d7',
            color: seedMessage.type === 'success' ? '#276749' : '#c53030',
            fontSize: '0.875rem',
          }}>
            {seedMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
