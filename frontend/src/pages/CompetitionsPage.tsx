import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { competitionsApi, studiosApi } from '../api/client';
import { Competition, CompetitionType, Studio } from '../types';

const CompetitionsPage = () => {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'UNAFFILIATED' as CompetitionType,
    date: new Date().toISOString().split('T')[0],
    location: '',
    studioId: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [compsRes, studiosRes] = await Promise.all([
        competitionsApi.getAll(),
        studiosApi.getAll(),
      ]);
      setCompetitions(compsRes.data);
      setStudios(studiosRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.type || !formData.date) {
      setError('Name, type, and date are required');
      return;
    }

    if (formData.type === 'STUDIO' && !formData.studioId) {
      setError('Studio is required for studio competitions');
      return;
    }

    try {
      await competitionsApi.create({
        name: formData.name,
        type: formData.type,
        date: formData.date,
        location: formData.location || undefined,
        studioId: formData.studioId ? parseInt(formData.studioId) : undefined,
        description: formData.description || undefined,
      });

      setFormData({
        name: '',
        type: 'UNAFFILIATED',
        date: new Date().toISOString().split('T')[0],
        location: '',
        studioId: '',
        description: '',
      });
      setShowForm(false);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create competition');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will delete all associated people, couples, judges, and events.`)) {
      return;
    }

    try {
      await competitionsApi.delete(id);
      loadData();
    } catch (error) {
      setError('Failed to delete competition');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTypeLabel = (type: CompetitionType) => {
    const labels: Record<CompetitionType, string> = {
      'NDCA': 'NDCA',
      'USA_DANCE': 'USA Dance',
      'UNAFFILIATED': 'Unaffiliated',
      'STUDIO': 'Studio',
    };
    return labels[type];
  };

  const getTypeColor = (type: CompetitionType) => {
    const colors: Record<CompetitionType, string> = {
      'NDCA': '#dc2626',
      'USA_DANCE': '#2563eb',
      'UNAFFILIATED': '#059669',
      'STUDIO': '#7c3aed',
    };
    return colors[type];
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>🏆 Competitions</h2>
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="btn"
          >
            {showForm ? 'Cancel' : '+ New Competition'}
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {showForm && (
          <div style={{
            background: '#f7fafc',
            border: '1px solid #cbd5e0',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ marginTop: 0 }}>Create New Competition</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Competition Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Spring Championship 2025"
                  required
                />
              </div>

              <div className="form-group">
                <label>Competition Type *</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['NDCA', 'USA_DANCE', 'UNAFFILIATED', 'STUDIO'] as CompetitionType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type, studioId: type === 'STUDIO' ? formData.studioId : '' })}
                      style={{
                        padding: '0.5rem 1rem',
                        border: formData.type === type ? `2px solid ${getTypeColor(type)}` : '1px solid #cbd5e0',
                        borderRadius: '4px',
                        background: formData.type === type ? getTypeColor(type) : 'white',
                        color: formData.type === type ? 'white' : '#2d3748',
                        cursor: 'pointer',
                        fontWeight: formData.type === type ? 'bold' : 'normal',
                        transition: 'all 0.2s',
                      }}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, State"
                  />
                </div>
              </div>

              {formData.type === 'STUDIO' && (
                <div className="form-group">
                  <label>Studio *</label>
                  {studios.length === 0 ? (
                    <div style={{ 
                      background: '#fef3c7', 
                      border: '1px solid #f59e0b',
                      padding: '1rem',
                      borderRadius: '4px',
                    }}>
                      <p style={{ margin: 0 }}>
                        No studios available. <button type="button" onClick={() => navigate('/studios')} style={{ color: '#667eea', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Create one first →</button>
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formData.studioId}
                      onChange={e => setFormData({ ...formData, studioId: e.target.value })}
                      required
                    >
                      <option value="">Select Studio</option>
                      {studios.map(studio => (
                        <option key={studio.id} value={studio.id}>
                          {studio.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the competition..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn">Create Competition</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {competitions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>No competitions created yet</p>
            <p>Create your first competition to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {competitions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(competition => (
                <div
                  key={competition.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    background: 'white',
                    transition: 'box-shadow 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>{competition.name}</h3>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            background: getTypeColor(competition.type),
                            color: 'white',
                          }}
                        >
                          {getTypeLabel(competition.type)}
                        </span>
                      </div>
                      <div style={{ color: '#718096', fontSize: '0.875rem' }}>
                        <p style={{ margin: '0.25rem 0' }}>📅 {formatDate(competition.date)}</p>
                        {competition.location && (
                          <p style={{ margin: '0.25rem 0' }}>📍 {competition.location}</p>
                        )}
                        {competition.description && (
                          <p style={{ margin: '0.5rem 0 0 0', color: '#4a5568' }}>
                            {competition.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/competitions/${competition.id}`)}
                        className="btn"
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleDelete(competition.id, competition.name)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', background: '#fee', color: '#c00' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionsPage;
