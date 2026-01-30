import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { couplesApi, peopleApi } from '../api/client';
import { Couple, Person } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

const CouplesPage = () => {
  const { activeCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [couples, setCouples] = useState<Couple[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderId, setLeaderId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeCompetition) {
      loadData();
    } else {
      setCouples([]);
      setPeople([]);
      setLoading(false);
    }
  }, [activeCompetition]);

  const loadData = async () => {
    if (!activeCompetition) return;
    
    try {
      const [couplesRes, peopleRes] = await Promise.all([
        couplesApi.getAll(activeCompetition.id),
        peopleApi.getAll(activeCompetition.id),
      ]);
      setCouples(couplesRes.data);
      setPeople(peopleRes.data);
      setError('');
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!leaderId || !followerId || !activeCompetition) return;
    
    try {
      await couplesApi.create(parseInt(leaderId), parseInt(followerId), activeCompetition.id);
      setLeaderId('');
      setFollowerId('');
      setError('');
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to add couple');
    }
  };

  const handleDelete = async (bib: number) => {
    if (!window.confirm('Are you sure you want to delete this couple?')) return;
    
    try {
      await couplesApi.delete(bib);
      setError('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete couple');
    }
  };

  const leaders = people.filter(p => p.role === 'leader' || p.role === 'both');
  const followers = people.filter(p => p.role === 'follower' || p.role === 'both');

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage couples.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>💃🕺 Manage Couples</h2>
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>⚠️ No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition from the dropdown above to manage couples.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>💃🕺 Manage Couples - {activeCompetition.name}</h2>
        <p style={{ color: '#718096', marginTop: '0.5rem' }}>
          Create couples by pairing leaders and followers. Each couple gets a unique bib number.
        </p>
        
        {error && <div className="error">{error}</div>}
        
        {people.length === 0 ? (
          <div style={{ 
            background: '#fef3c7', 
            border: '1px solid #f59e0b', 
            padding: '1rem', 
            borderRadius: '4px',
            marginTop: '1rem'
          }}>
            <strong>⚠️ No people available</strong>
            <p style={{ margin: '0.5rem 0 0 0' }}>
              You need to add people first before creating couples.{' '}
              <Link to="/people" style={{ fontWeight: 'bold' }}>Go to People page →</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleAdd} style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Leader</label>
                <select value={leaderId} onChange={e => setLeaderId(e.target.value)} required>
                  <option value="">Select Leader</option>
                  {leaders.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Follower</label>
                <select value={followerId} onChange={e => setFollowerId(e.target.value)} required>
                  <option value="">Select Follower</option>
                  {followers.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn">➕ Add Couple</button>
            </div>
          </form>
        )}

        {couples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096', marginTop: '1rem' }}>
            <h3>No couples created yet</h3>
            <p>Add your first couple using the form above!</p>
          </div>
        ) : (
          <table style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Bib #</th>
                <th>Leader</th>
                <th>Follower</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {couples.map(couple => (
                <tr key={couple.bib}>
                  <td><strong>#{couple.bib}</strong></td>
                  <td>{couple.leaderName}</td>
                  <td>{couple.followerName}</td>
                  <td>
                    <button 
                      onClick={() => handleDelete(couple.bib)} 
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

      {couples.length > 0 && (
        <div className="card">
          <h3>Quick Stats</h3>
          <p>Total Couples: <strong>{couples.length}</strong></p>
        </div>
      )}
    </div>
  );
};

export default CouplesPage;
