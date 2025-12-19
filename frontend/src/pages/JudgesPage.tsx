import React, { useEffect, useState } from 'react';
import { judgesApi } from '../api/client';
import { Judge } from '../types';

const JudgesPage: React.FC = () => {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadJudges();
  }, []);

  const loadJudges = async () => {
    try {
      const response = await judgesApi.getAll();
      setJudges(response.data);
      setError('');
    } catch (error) {
      console.error('Failed to load judges:', error);
      setError('Failed to load judges');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim()) return;
    
    try {
      await judgesApi.create(newJudgeName.trim());
      setNewJudgeName('');
      setError('');
      loadJudges();
    } catch (error) {
      console.error('Failed to add judge:', error);
      setError('Failed to add judge');
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>⚖️ Manage Judges</h2>
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
        </div>
      )}
    </div>
  );
};

export default JudgesPage;
