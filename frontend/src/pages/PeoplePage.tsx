import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { peopleApi, studiosApi } from '../api/client';
import { Person, Studio } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

const PeoplePage = () => {
  const { activeCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPerson, setNewPerson] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    role: 'both' as Person['role'],
    status: 'student' as Person['status'],
    studioId: '' as string | number
  });

  useEffect(() => {
    if (activeCompetition) {
      loadPeople();
      loadStudios();
    } else {
      setPeople([]);
      setStudios([]);
      setLoading(false);
    }
  }, [activeCompetition]);

  const loadStudios = async () => {
    try {
      const response = await studiosApi.getAll();
      setStudios(response.data);
    } catch (error) {
      setStudios([]);
    }
  };

  const loadPeople = async () => {
    if (!activeCompetition) return;
    
    try {
      const response = await peopleApi.getAll(activeCompetition.id);
      setPeople(response.data);
    } catch (error) {
      console.error('Failed to load people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPerson.firstName || !newPerson.lastName || !activeCompetition) return;

    try {
      await peopleApi.create({
        ...newPerson,
        studioId: newPerson.studioId ? Number(newPerson.studioId) : undefined,
        email: newPerson.email || undefined,
        dateOfBirth: newPerson.dateOfBirth || undefined,
        competitionId: activeCompetition.id,
      });
      setNewPerson({ firstName: '', lastName: '', dateOfBirth: '', email: '', role: 'both', status: 'student', studioId: '' });
      loadPeople();
    } catch (error) {
      console.error('Failed to add person:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this person?')) return;
    
    try {
      await peopleApi.delete(id);
      loadPeople();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete person');
    }
  };

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage people.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>Manage People</h2>
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>⚠️ No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition from the dropdown above to manage people.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Manage People - {activeCompetition.name}</h2>
        
        <form onSubmit={handleAdd} style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>First Name</label>
              <input
                type="text"
                value={newPerson.firstName}
                onChange={e => setNewPerson({ ...newPerson, firstName: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Last Name</label>
              <input
                type="text"
                value={newPerson.lastName}
                onChange={e => setNewPerson({ ...newPerson, lastName: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>DOB</label>
              <input
                type="date"
                value={newPerson.dateOfBirth}
                onChange={e => setNewPerson({ ...newPerson, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Email</label>
              <input
                type="email"
                value={newPerson.email}
                onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Role</label>
              <select value={newPerson.role} onChange={e => setNewPerson({ ...newPerson, role: e.target.value as Person['role'] })}>
                <option value="leader">Leader</option>
                <option value="follower">Follower</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Status</label>
              <select value={newPerson.status} onChange={e => setNewPerson({ ...newPerson, status: e.target.value as Person['status'] })}>
                <option value="student">Student</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Studio</label>
              <select value={newPerson.studioId} onChange={e => setNewPerson({ ...newPerson, studioId: e.target.value })}>
                <option value="">None</option>
                {studios.map(studio => (
                  <option key={studio.id} value={studio.id}>{studio.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn" style={{ marginBottom: 0 }}>Add</button>
          </div>
        </form>

        {people.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>No people added yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>DOB</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Studio</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id}>
                  <td>{person.firstName}</td>
                  <td>{person.lastName}</td>
                  <td>{person.dateOfBirth || ''}</td>
                  <td>{person.email || ''}</td>
                  <td>{person.role}</td>
                  <td>{person.status}</td>
                  <td>{studios.find(s => s.id === person.studioId)?.name || ''}</td>
                  <td>
                    <button onClick={() => handleDelete(person.id)} className="btn btn-danger" style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PeoplePage;
