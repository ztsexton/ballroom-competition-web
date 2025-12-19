import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { peopleApi } from '../api/client';
import { Person } from '../types';

const PeoplePage = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPerson, setNewPerson] = useState({ name: '', role: 'both' as Person['role'], status: 'student' as Person['status'] });

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      const response = await peopleApi.getAll();
      setPeople(response.data);
    } catch (error) {
      console.error('Failed to load people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPerson.name) return;
    
    try {
      await peopleApi.create(newPerson);
      setNewPerson({ name: '', role: 'both', status: 'student' });
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container">
      <div className="card">
        <h2>Manage People</h2>
        
        <form onSubmit={handleAdd} style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Name</label>
              <input
                type="text"
                value={newPerson.name}
                onChange={e => setNewPerson({ ...newPerson, name: e.target.value })}
                required
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
            <button type="submit" className="btn" style={{ marginBottom: 0 }}>Add</button>
          </div>
        </form>

        {people.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>No people added yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id}>
                  <td>{person.name}</td>
                  <td>{person.role}</td>
                  <td>{person.status}</td>
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
