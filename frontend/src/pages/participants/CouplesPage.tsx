import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { couplesApi, peopleApi } from '../../api/client';
import { Couple, Person } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';

const CouplesPage = () => {
  const { activeCompetition } = useCompetition();
  const { isAnyAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [couples, setCouples] = useState<Couple[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderId, setLeaderId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBib, setDeleteBib] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBibCoupleId, setEditingBibCoupleId] = useState<number | null>(null);
  const [editBibValue, setEditBibValue] = useState('');
  const [savingBib, setSavingBib] = useState(false);

  // Inline person creation state
  const [leaderMode, setLeaderMode] = useState<'select' | 'new'>('select');
  const [followerMode, setFollowerMode] = useState<'select' | 'new'>('select');
  const [newLeader, setNewLeader] = useState({ firstName: '', lastName: '' });
  const [newFollower, setNewFollower] = useState({ firstName: '', lastName: '' });

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
    if (!activeCompetition) return;

    setSubmitting(true);
    try {
      let resolvedLeaderId = leaderId ? parseInt(leaderId) : 0;
      let resolvedFollowerId = followerId ? parseInt(followerId) : 0;

      if (leaderMode === 'new') {
        if (!newLeader.firstName.trim() || !newLeader.lastName.trim()) {
          setError('Leader first and last name are required');
          setSubmitting(false);
          return;
        }
        const res = await peopleApi.create({
          firstName: newLeader.firstName.trim(),
          lastName: newLeader.lastName.trim(),
          role: 'leader',
          competitionId: activeCompetition.id,
          status: 'student',
        });
        resolvedLeaderId = res.data.id;
      }

      if (followerMode === 'new') {
        if (!newFollower.firstName.trim() || !newFollower.lastName.trim()) {
          setError('Follower first and last name are required');
          setSubmitting(false);
          return;
        }
        const res = await peopleApi.create({
          firstName: newFollower.firstName.trim(),
          lastName: newFollower.lastName.trim(),
          role: 'follower',
          competitionId: activeCompetition.id,
          status: 'student',
        });
        resolvedFollowerId = res.data.id;
      }

      if (!resolvedLeaderId || !resolvedFollowerId) {
        setError('Please select or create both a leader and follower');
        setSubmitting(false);
        return;
      }

      await couplesApi.create(resolvedLeaderId, resolvedFollowerId, activeCompetition.id);
      setLeaderId('');
      setFollowerId('');
      setLeaderMode('select');
      setFollowerMode('select');
      setNewLeader({ firstName: '', lastName: '' });
      setNewFollower({ firstName: '', lastName: '' });
      setError('');
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to add couple');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await couplesApi.delete(id);
      setError('');
      loadData();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete couple', 'error');
    }
  };

  const handleReassignBib = async (couple: Couple) => {
    const newBib = parseInt(editBibValue);
    if (!newBib || newBib < 1) {
      showToast('Bib must be a positive number', 'error');
      return;
    }
    if (newBib === couple.bib) {
      setEditingBibCoupleId(null);
      return;
    }
    setSavingBib(true);
    try {
      await peopleApi.reassignBib(couple.leaderId, newBib);
      showToast(`Bib reassigned from #${couple.bib} to #${newBib}`, 'success');
      setEditingBibCoupleId(null);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reassign bib', 'error');
    } finally {
      setSavingBib(false);
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

  if (!isAnyAdmin) {
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-600">Leader</label>
                  {leaderMode === 'new' && (
                    <button type="button" onClick={() => { setLeaderMode('select'); setNewLeader({ firstName: '', lastName: '' }); }}
                      className="text-xs text-primary-500 bg-transparent border-none cursor-pointer hover:underline">Cancel</button>
                  )}
                </div>
                {leaderMode === 'select' ? (
                  <select value={leaderId} onChange={e => {
                    if (e.target.value === '__new__') { setLeaderMode('new'); setLeaderId(''); }
                    else setLeaderId(e.target.value);
                  }} required={leaderMode === 'select'}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                    <option value="">Select Leader</option>
                    {leaders.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Person</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input type="text" placeholder="First name" value={newLeader.firstName}
                      onChange={e => setNewLeader(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
                    <input type="text" placeholder="Last name" value={newLeader.lastName}
                      onChange={e => setNewLeader(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-600">Follower</label>
                  {followerMode === 'new' && (
                    <button type="button" onClick={() => { setFollowerMode('select'); setNewFollower({ firstName: '', lastName: '' }); }}
                      className="text-xs text-primary-500 bg-transparent border-none cursor-pointer hover:underline">Cancel</button>
                  )}
                </div>
                {followerMode === 'select' ? (
                  <select value={followerId} onChange={e => {
                    if (e.target.value === '__new__') { setFollowerMode('new'); setFollowerId(''); }
                    else setFollowerId(e.target.value);
                  }} required={followerMode === 'select'}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                    <option value="">Select Follower</option>
                    {followers.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName} {person.status === 'professional' ? '(Pro)' : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Person</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input type="text" placeholder="First name" value={newFollower.firstName}
                      onChange={e => setNewFollower(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
                    <input type="text" placeholder="Last name" value={newFollower.lastName}
                      onChange={e => setNewFollower(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Adding...' : 'Add Couple'}</button>
            </div>
          </form>
        )}

        <div className="mt-4 mb-2">
          <input
            type="text"
            placeholder="Search by ID, bib, leader, or follower..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            aria-label="Search couples"
          />
        </div>

        {(() => {
          const filteredCouples = couples.filter(c => {
            const term = searchTerm.toLowerCase();
            return !term || c.id.toString().includes(term) || c.bib.toString().includes(term) || (c.leaderName || '').toLowerCase().includes(term) || (c.followerName || '').toLowerCase().includes(term);
          });

          if (filteredCouples.length === 0) {
            return (
              <div className="text-center py-8 text-gray-500 mt-4">
                <h3 className="font-semibold mb-1">{searchTerm ? 'No couples match your search' : 'No couples created yet'}</h3>
                {!searchTerm && <p>Add your first couple using the form above!</p>}
              </div>
            );
          }

          return (
          <div className="overflow-x-auto">
          <table className="w-full text-sm mt-4">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">ID</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Bib #</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Leader</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Follower</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCouples.map(couple => (
                <tr key={couple.id}>
                  <td className="px-3 py-2 border-t border-gray-100 text-gray-400">{couple.id}</td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    {editingBibCoupleId === couple.id ? (
                      <form
                        onSubmit={e => { e.preventDefault(); handleReassignBib(couple); }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="number"
                          min="1"
                          value={editBibValue}
                          onChange={e => setEditBibValue(e.target.value)}
                          className="w-20 px-2 py-1 border border-primary-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                          autoFocus
                          disabled={savingBib}
                        />
                        <button
                          type="submit"
                          disabled={savingBib}
                          className="px-2 py-1 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-primary-600 disabled:opacity-50"
                        >
                          {savingBib ? '...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBibCoupleId(null)}
                          disabled={savingBib}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs font-medium hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => { setEditingBibCoupleId(couple.id); setEditBibValue(String(couple.bib)); }}
                        className="font-bold text-primary-600 bg-transparent border-none cursor-pointer hover:underline text-sm"
                        title="Click to reassign bib number"
                      >
                        #{couple.bib}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.leaderName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">{couple.followerName}</td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => { setDeleteId(couple.id); setDeleteBib(couple.bib); }}
                      className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                      aria-label={`Delete couple #${couple.bib}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          );
        })()}
      </div>

      {couples.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Stats</h3>
          <p className="text-gray-600">Total Couples: <strong>{couples.length}</strong></p>
        </div>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Couple"
        message={`Are you sure you want to delete couple #${deleteBib}?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteId !== null) handleDelete(deleteId); setDeleteId(null); setDeleteBib(null); }}
        onCancel={() => { setDeleteId(null); setDeleteBib(null); }}
      />
    </div>
  );
};

export default CouplesPage;
