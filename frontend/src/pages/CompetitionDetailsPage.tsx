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
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn" onClick={() => navigate(`/events?competitionId=${competition.id}`)}>
            Manage Events
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
