import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { competitionsApi, studiosApi } from '../api/client';
import { Competition, Studio } from '../types';
import { useAuth } from '../context/AuthContext';

const CompetitionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadCompetition();
    }
  }, [id]);

  const loadCompetition = async () => {
    setLoading(true);
    setError('');
    try {
      const compRes = await competitionsApi.getById(Number(id));
      setCompetition(compRes.data);
      if (compRes.data.type === 'STUDIO' && compRes.data.studioId) {
        const studioRes = await studiosApi.getById(compRes.data.studioId);
        setStudio(studioRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Competition not found');
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;
  if (error) return <div className="container"><div className="card">{error}</div></div>;
  if (!competition) return <div className="container"><div className="card">Competition not found</div></div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to view competition details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>{competition.name}</h2>
        <p><strong>Type:</strong> {competition.type}</p>
        <p><strong>Date:</strong> {new Date(competition.date).toLocaleDateString()}</p>
        {competition.location && <p><strong>Location:</strong> {competition.location}</p>}
        {competition.type === 'STUDIO' && studio && (
          <p><strong>Studio:</strong> {studio.name} ({studio.contactInfo || 'No contact'})</p>
        )}
        {competition.description && <p><strong>Description:</strong> {competition.description}</p>}
        {competition.levels && competition.levels.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Levels:</strong>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {competition.levels.map((level, idx) => (
                <span key={idx} style={{
                  padding: '0.25rem 0.75rem',
                  background: '#edf2f7',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                }}>
                  {level}
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate(`/events?competitionId=${competition.id}`)}>
            Manage Events
          </button>
          <button className="btn" onClick={() => navigate(`/competitions/${competition.id}/schedule`)}>
            Schedule
          </button>
          <button className="btn btn-success" onClick={() => navigate(`/competitions/${competition.id}/run`)}>
            Run Competition
          </button>
          <button className="btn" onClick={() => navigate(`/competitions/${competition.id}/ondeck`)}>
            On-Deck View
          </button>
          <button className="btn" onClick={() => navigate(`/competitions/${competition.id}/live`)}>
            Live View
          </button>
          <button className="btn" onClick={() => navigate(`/competitions/${competition.id}/judge`)}>
            Judge Scoring
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/competitions')}>
            Back to Competitions
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetitionDetailsPage;
