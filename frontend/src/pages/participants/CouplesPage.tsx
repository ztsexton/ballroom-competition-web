import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { couplesApi, peopleApi } from '../../api/client';
import { Couple, Person } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/Skeleton';

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

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="table" rows={5} cols={4} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500">You must be an admin to manage couples.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Manage Couples</h2>
          <div className="text-center p-12 bg-amber-50 border border-amber-400 rounded-lg">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition from the dropdown above to manage couples.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Manage Couples - {activeCompetition.name}</h2>
        <p className="text-gray-500 mt-2">
          Create couples by pairing leaders and followers. Each couple gets a unique bib number.
        </p>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm mt-3">{error}</div>}

        {people.length === 0 ? (
          <div className="bg-amber-50 border border-amber-400 p-4 rounded mt-4">
            <strong>No people available</strong>
            <p className="mt-2">
              You need to add people first before creating couples.{' '}
              <Link to="/people" className="font-bold text-primary-500">Go to People page</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleAdd} className="mt-6">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Leader</label>
                <select value={leaderId} onChange={e => setLeaderId(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  <option value="">Select Leader</option>
                  {leaders.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Follower</label>
                <select value={followerId} onChange={e => setFollowerId(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  <option value="">Select Follower</option>
                  {followers.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">Add Couple</button>
            </div>
          </form>
        )}

        {couples.length === 0 ? (
          <div className="text-center py-8 text-gray-500 mt-4">
            <h3 className="font-semibold mb-1">No couples created yet</h3>
            <p>Add your first couple using the form above!</p>
          </div>
        ) : (
          <table className="w-full text-sm mt-4">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Bib #</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Leader</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Follower</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {couples.map(couple => (
                <tr key={couple.bib}>
                  <td className="px-3 py-2 border-t border-gray-100"><strong>#{couple.bib}</strong></td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.leaderName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.followerName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => handleDelete(couple.bib)}
                      className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Stats</h3>
          <p className="text-gray-600">Total Couples: <strong>{couples.length}</strong></p>
        </div>
      )}
    </div>
  );
};

export default CouplesPage;
