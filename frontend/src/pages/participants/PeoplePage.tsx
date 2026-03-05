import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { peopleApi, studiosApi } from '../../api/client';
import { Person, Studio } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/Skeleton';

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

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="table" rows={5} cols={7} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500">You must be an admin to manage people.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Manage People</h2>
          <div className="text-center p-12 bg-amber-50 border border-amber-400 rounded-lg">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition from the dropdown above to manage people.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Manage People - {activeCompetition.name}</h2>

        <form onSubmit={handleAdd} className="mt-4">
          <div className="grid grid-cols-[1.2fr_1.2fr_1fr_2fr_1fr_1fr_1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">First Name</label>
              <input
                type="text"
                value={newPerson.firstName}
                onChange={e => setNewPerson({ ...newPerson, firstName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Name</label>
              <input
                type="text"
                value={newPerson.lastName}
                onChange={e => setNewPerson({ ...newPerson, lastName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">DOB</label>
              <input
                type="date"
                value={newPerson.dateOfBirth}
                onChange={e => setNewPerson({ ...newPerson, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={newPerson.email}
                onChange={e => setNewPerson({ ...newPerson, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Role</label>
              <select value={newPerson.role} onChange={e => setNewPerson({ ...newPerson, role: e.target.value as Person['role'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="leader">Leader</option>
                <option value="follower">Follower</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
              <select value={newPerson.status} onChange={e => setNewPerson({ ...newPerson, status: e.target.value as Person['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="student">Student</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Studio</label>
              <select value={newPerson.studioId} onChange={e => setNewPerson({ ...newPerson, studioId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                <option value="">None</option>
                {studios.map(studio => (
                  <option key={studio.id} value={studio.id}>{studio.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">Add</button>
          </div>
        </form>

        {people.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No people added yet</p>
        ) : (
          <table className="w-full text-sm mt-4">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">First Name</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Last Name</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">DOB</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Email</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Role</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Status</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Studio</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id}>
                  <td className="px-3 py-2 border-t border-gray-100">{person.firstName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{person.lastName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{person.dateOfBirth || ''}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{person.email || ''}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{person.role}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{person.status}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{studios.find(s => s.id === person.studioId)?.name || ''}</td>
                  <td className="px-3 py-2 border-t border-gray-100 space-x-2">
                    <Link
                      to={`/competitions/${activeCompetition?.id}/heat-sheet?personId=${person.id}`}
                      className="px-2 py-1 bg-primary-500 text-white rounded text-sm font-medium transition-colors hover:bg-primary-600 inline-block no-underline"
                    >
                      Heat Sheet
                    </Link>
                    <button onClick={() => handleDelete(person.id)} className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
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
