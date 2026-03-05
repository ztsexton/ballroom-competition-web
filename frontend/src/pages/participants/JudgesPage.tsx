import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { judgesApi, judgeProfilesApi } from '../../api/client';
import { Judge, JudgeProfile } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';

const JudgesPage = () => {
  const { activeCompetition } = useCompetition();
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [profiles, setProfiles] = useState<JudgeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJudgeName, setNewJudgeName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Judge | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeCompetition) {
      loadJudges();
    } else {
      setJudges([]);
      setLoading(false);
    }
    // Load profiles for the dropdown (site admin only)
    if (isAdmin) {
      judgeProfilesApi.getAll()
        .then(res => setProfiles(res.data))
        .catch(() => {});
    }
  }, [activeCompetition, isAdmin]);

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

    setSubmitting(true);
    try {
      await judgesApi.create(
        newJudgeName.trim(),
        activeCompetition.id,
        selectedProfileId ? Number(selectedProfileId) : undefined,
      );
      setNewJudgeName('');
      setSelectedProfileId('');
      setError('');
      loadJudges();
    } catch (error) {
      console.error('Failed to add judge:', error);
      setError('Failed to add judge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileSelect = (profileId: number | '') => {
    setSelectedProfileId(profileId);
    if (profileId) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        setNewJudgeName(`${profile.firstName} ${profile.lastName}`);
      }
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
    try {
      await judgesApi.delete(id);
      setError('');
      loadJudges();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete judge', 'error');
    }
  };

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
          <p className="text-gray-500">You must be an admin to manage judges.</p>
        </div>
      </div>
    );
  }

  if (!activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Manage Judges</h2>
          <div className="text-center p-12 bg-amber-50 border border-amber-400 rounded-lg">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition from the dropdown above to manage judges.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Manage Judges - {activeCompetition.name}</h2>
        <p className="text-gray-500 mt-2">
          Add and manage competition judges. Judge numbers are automatically assigned.
        </p>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm mt-3">{error}</div>}

        <form onSubmit={handleAdd} className="mt-6">
          <div className="flex gap-2 items-end flex-wrap">
            {profiles.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">From Profile</label>
                <select
                  value={selectedProfileId}
                  onChange={e => handleProfileSelect(e.target.value ? Number(e.target.value) : '')}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Manual entry</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-600 mb-1">Judge Name</label>
              <input
                type="text"
                value={newJudgeName}
                onChange={e => setNewJudgeName(e.target.value)}
                placeholder="Enter judge name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Adding...' : 'Add Judge'}</button>
          </div>
        </form>

        <div className="mt-4 mb-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            aria-label="Search judges"
          />
        </div>

        {(() => {
          const filteredJudges = judges.filter(j => {
            const term = searchTerm.toLowerCase();
            return !term || j.name.toLowerCase().includes(term);
          });

          if (filteredJudges.length === 0) {
            return (
              <div className="text-center py-8 text-gray-500 mt-4">
                <h3 className="font-semibold mb-1">{searchTerm ? 'No judges match your search' : 'No judges registered yet'}</h3>
                {!searchTerm && <p>Add your first judge using the form above!</p>}
              </div>
            );
          }

          return (
          <div className="overflow-x-auto">
          <table className="w-full text-sm mt-4">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Judge #</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Name</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Chairman</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJudges.map(judge => (
                <tr key={judge.id}>
                  <td className="px-3 py-2 border-t border-gray-100"><strong>#{judge.judgeNumber}</strong></td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    {judge.name}
                    {judge.profileId && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded" title="Linked to site profile">
                        Profile
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => handleToggleChairman(judge.id, !!judge.isChairman)}
                      className={`bg-transparent border-none cursor-pointer text-lg px-2 py-1 ${judge.isChairman ? 'text-yellow-500' : 'text-gray-300'}`}
                      title={judge.isChairman ? 'Remove Chairman' : 'Set as Chairman'}
                    >
                      {judge.isChairman ? '\u2605 Chairman' : '\u2606'}
                    </button>
                  </td>
                  <td className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => setDeleteTarget(judge)}
                      className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                      aria-label={`Delete ${judge.name}`}
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

      {judges.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Stats</h3>
          <p className="text-gray-600">Total Judges: <strong>{judges.length}</strong></p>
          <p className="text-gray-600">Chairman: <strong>{judges.find(j => j.isChairman)?.name || 'Not assigned'}</strong></p>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Judge"
        message={deleteTarget ? `Are you sure you want to delete judge ${deleteTarget.name}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default JudgesPage;
