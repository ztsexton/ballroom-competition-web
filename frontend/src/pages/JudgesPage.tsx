import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { judgesApi } from '../api/client';
import { Judge } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

const JudgesPage = () => {
  const { activeCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeCompetition) {
      loadJudges();
    } else {
      setJudges([]);
      setLoading(false);
    }
  }, [activeCompetition]);

  const loadJudges = async () => {
    if (!activeCompetition) return;
    
    try {
      const response = await judgesApi.getAll(activeCompetition.id);
      setJudges(response.data);
      setError('');
    } catch (error) {
      console.error('Failed to load judges:', error);
      setError('Failed to load judges');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim() || !activeCompetition) return;
    
    try {
      await judgesApi.create(newJudgeName.trim(), activeCompetition.id);
      setNewJudgeName('');
      setError('');
      loadJudges();
    } catch (error) {
      console.error('Failed to add judge:', error);
      setError('Failed to add judge');
    }
  };

  const handleToggleChairman = async (judgeId: number, currentlyChairman: boolean) => {
    try {
      await judgesApi.update(judgeId, { isChairman: !currentlyChairman });
      setError('');
      loadJudges();
    } catch (error) {
      console.error('Failed to update chairman:', error);
      setError('Failed to update chairman');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this judge?')) return;
    
    try {
      await judgesApi.delete(id);
      setError('');
      loadJudges();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete judge');
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage judges.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>⚖️ Manage Judges</h2>
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>⚠️ No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition from the dropdown above to manage judges.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>⚖️ Manage Judges - {activeCompetition.name}</h2>
        <p style={{ color: '#718096', marginTop: '0.5rem' }}>
          Add and manage competition judges. Judge numbers are automatically assigned.
        </p>
        
        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleAdd} style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Judge Name</label>
              <input
                type="text"
                value={newJudgeName}
                onChange={e => setNewJudgeName(e.target.value)}
                placeholder="Enter judge name"
                required
              />
            </div>
            <button type="submit" className="btn">➕ Add Judge</button>
          </div>
        </form>

        {judges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096', marginTop: '1rem' }}>
            <h3>No judges registered yet</h3>
            <p>Add your first judge using the form above!</p>
          </div>
        ) : (
          <table style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Judge #</th>
                <th>Name</th>
                <th>Chairman</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map(judge => (
                <tr key={judge.id}>
                  <td><strong>#{judge.judgeNumber}</strong></td>
                  <td>{judge.name}</td>
                  <td>
                    <button
                      onClick={() => handleToggleChairman(judge.id, !!judge.isChairman)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        color: judge.isChairman ? '#d69e2e' : '#cbd5e0',
                        padding: '0.25rem 0.5rem',
                      }}
                      title={judge.isChairman ? 'Remove Chairman' : 'Set as Chairman'}
                    >
                      {judge.isChairman ? '★ Chairman' : '☆'}
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(judge.id)}
                      className="btn btn-danger"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {judges.length > 0 && (
        <div className="card">
          <h3>Quick Stats</h3>
          <p>Total Judges: <strong>{judges.length}</strong></p>
          <p>Chairman: <strong>{judges.find(j => j.isChairman)?.name || 'Not assigned'}</strong></p>
        </div>
      )}
    </div>
  );
};

export default JudgesPage;
