import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { couplesApi, peopleApi } from '../../../../api/client';
import { Person, Couple, Competition } from '../../../../types';
import { useToast } from '../../../../context/ToastContext';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { useRegistrationPanel } from '../../hooks/useRegistrationPanel';
import CoupleRegistrationPanel from './CoupleRegistrationPanel';

interface CouplesTabProps {
  couples: Couple[];
  people: Person[];
  competitionId: number;
  activeCompetition: Competition | null;
  onDataChange: () => void;
}

const CouplesTab = ({ couples, people, competitionId, activeCompetition, onDataChange }: CouplesTabProps) => {
  const { showToast } = useToast();
  const [leaderId, setLeaderId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const [coupleError, setCoupleError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteBib, setDeleteBib] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingBibCoupleId, setEditingBibCoupleId] = useState<number | null>(null);
  const [editBibValue, setEditBibValue] = useState('');
  const [savingBib, setSavingBib] = useState(false);

  // Inline person creation state
  const [leaderMode, setLeaderMode] = useState<'select' | 'new'>('select');
  const [followerMode, setFollowerMode] = useState<'select' | 'new'>('select');
  const [newLeader, setNewLeader] = useState({ firstName: '', lastName: '' });
  const [newFollower, setNewFollower] = useState({ firstName: '', lastName: '' });

  const registration = useRegistrationPanel(competitionId, activeCompetition, people, couples);

  const leaders = people.filter(p => p.role === 'leader' || p.role === 'both');
  const followers = people.filter(p => p.role === 'follower' || p.role === 'both');

  const handleAddCouple = async (e: FormEvent) => {
    e.preventDefault();
    setCoupleError('');
    setSubmitting(true);

    try {
      let resolvedLeaderId = leaderId ? parseInt(leaderId) : 0;
      let resolvedFollowerId = followerId ? parseInt(followerId) : 0;

      // Create new leader if needed
      if (leaderMode === 'new') {
        if (!newLeader.firstName.trim() || !newLeader.lastName.trim()) {
          setCoupleError('Leader first and last name are required');
          setSubmitting(false);
          return;
        }
        const res = await peopleApi.create({
          firstName: newLeader.firstName.trim(),
          lastName: newLeader.lastName.trim(),
          role: 'leader',
          competitionId,
          status: 'student',
        });
        resolvedLeaderId = res.data.id;
      }

      // Create new follower if needed
      if (followerMode === 'new') {
        if (!newFollower.firstName.trim() || !newFollower.lastName.trim()) {
          setCoupleError('Follower first and last name are required');
          setSubmitting(false);
          return;
        }
        const res = await peopleApi.create({
          firstName: newFollower.firstName.trim(),
          lastName: newFollower.lastName.trim(),
          role: 'follower',
          competitionId,
          status: 'student',
        });
        resolvedFollowerId = res.data.id;
      }

      if (!resolvedLeaderId || !resolvedFollowerId) {
        setCoupleError('Please select or create both a leader and follower');
        setSubmitting(false);
        return;
      }

      await couplesApi.create(resolvedLeaderId, resolvedFollowerId, competitionId);

      // Reset form
      setLeaderId('');
      setFollowerId('');
      setLeaderMode('select');
      setFollowerMode('select');
      setNewLeader({ firstName: '', lastName: '' });
      setNewFollower({ firstName: '', lastName: '' });
      setCoupleError('');
      onDataChange();
    } catch (err: unknown) {
      setCoupleError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add couple' : 'Failed to add couple');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCouple = async (id: number) => {
    try {
      await couplesApi.delete(id);
      setCoupleError('');
      onDataChange();
    } catch (err: unknown) {
      showToast(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to delete couple' : 'Failed to delete couple', 'error');
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
      onDataChange();
    } catch (err: unknown) {
      showToast(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to reassign bib' : 'Failed to reassign bib', 'error');
    } finally {
      setSavingBib(false);
    }
  };

  const selectCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";
  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="mt-0 mb-3">Couples</h3>
      <div>
        {coupleError && <div className="text-danger-500 mt-2 mb-2">{coupleError}</div>}

        <form onSubmit={handleAddCouple} className="mb-4">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            {/* Leader column */}
            <div className="mb-0">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-600">Leader</label>
                {leaderMode === 'new' && (
                  <button type="button" onClick={() => { setLeaderMode('select'); setNewLeader({ firstName: '', lastName: '' }); }}
                    className="text-xs text-primary-500 bg-transparent border-none cursor-pointer hover:underline">
                    Cancel
                  </button>
                )}
              </div>
              {leaderMode === 'select' ? (
                <select className={selectCls} value={leaderId} onChange={e => {
                  if (e.target.value === '__new__') {
                    setLeaderMode('new');
                    setLeaderId('');
                  } else {
                    setLeaderId(e.target.value);
                  }
                }} required={leaderMode === 'select'}>
                  <option value="">Select Leader</option>
                  <option value="__new__">+ Create New Person</option>
                  {leaders.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input type="text" placeholder="First name" value={newLeader.firstName}
                    onChange={e => setNewLeader(prev => ({ ...prev, firstName: e.target.value }))}
                    className={inputCls} required />
                  <input type="text" placeholder="Last name" value={newLeader.lastName}
                    onChange={e => setNewLeader(prev => ({ ...prev, lastName: e.target.value }))}
                    className={inputCls} required />
                </div>
              )}
            </div>

            {/* Follower column */}
            <div className="mb-0">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-600">Follower</label>
                {followerMode === 'new' && (
                  <button type="button" onClick={() => { setFollowerMode('select'); setNewFollower({ firstName: '', lastName: '' }); }}
                    className="text-xs text-primary-500 bg-transparent border-none cursor-pointer hover:underline">
                    Cancel
                  </button>
                )}
              </div>
              {followerMode === 'select' ? (
                <select className={selectCls} value={followerId} onChange={e => {
                  if (e.target.value === '__new__') {
                    setFollowerMode('new');
                    setFollowerId('');
                  } else {
                    setFollowerId(e.target.value);
                  }
                }} required={followerMode === 'select'}>
                  <option value="">Select Follower</option>
                  <option value="__new__">+ Create New Person</option>
                  {followers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input type="text" placeholder="First name" value={newFollower.firstName}
                    onChange={e => setNewFollower(prev => ({ ...prev, firstName: e.target.value }))}
                    className={inputCls} required />
                  <input type="text" placeholder="Last name" value={newFollower.lastName}
                    onChange={e => setNewFollower(prev => ({ ...prev, lastName: e.target.value }))}
                    className={inputCls} required />
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed mb-0">
              {submitting ? 'Adding...' : 'Add Couple'}
            </button>
          </div>
        </form>

        {couples.length === 0 ? (
          <p className="text-center p-4 text-gray-500">No couples created yet.</p>
        ) : (
          <div>
            {couples.map(couple => {
              const isOpen = registration.registerBib === couple.bib;

              return (
                <div key={couple.id} className="border-b border-gray-200">
                  <div className="flex items-center py-2.5 gap-4">
                    <div className="flex flex-col min-w-[5rem]">
                      {editingBibCoupleId === couple.id ? (
                        <form
                          onSubmit={e => { e.preventDefault(); handleReassignBib(couple); }}
                          className="flex items-center gap-1"
                        >
                          <span className="text-xs text-gray-400 mr-1">Bib</span>
                          <input
                            type="number"
                            min="1"
                            value={editBibValue}
                            onChange={e => setEditBibValue(e.target.value)}
                            className="w-16 px-1.5 py-0.5 border border-primary-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                            autoFocus
                            disabled={savingBib}
                          />
                          <button type="submit" disabled={savingBib}
                            className="px-1.5 py-0.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-primary-600 disabled:opacity-50">
                            {savingBib ? '...' : 'Save'}
                          </button>
                          <button type="button" onClick={() => setEditingBibCoupleId(null)} disabled={savingBib}
                            className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs font-medium hover:bg-gray-300 disabled:opacity-50">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingBibCoupleId(couple.id); setEditBibValue(String(couple.bib)); }}
                            className="font-bold text-left text-primary-600 bg-transparent border-none cursor-pointer hover:underline text-sm p-0"
                            title="Click to reassign bib number"
                          >
                            Bib #{couple.bib}
                          </button>
                          <span className="text-[11px] text-gray-400 leading-tight">Couple ID: {couple.id}</span>
                        </>
                      )}
                    </div>
                    <span className="flex-1">{couple.leaderName} & {couple.followerName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => registration.openRegisterPanel(couple.bib)}
                        className={`px-2 py-1 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors ${isOpen ? 'bg-primary-700 hover:bg-primary-800' : 'bg-primary-500 hover:bg-primary-600'}`}
                      >
                        {isOpen ? 'Close' : 'Register'}
                      </button>
                      <button
                        onClick={() => { setDeleteId(couple.id); setDeleteBib(couple.bib); }}
                        aria-label={`Delete couple #${couple.bib}`}
                        className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <CoupleRegistrationPanel
                      bib={couple.bib}
                      activeCompetition={activeCompetition}
                      registration={registration}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleteBib !== null}
        title="Delete Couple"
        message={deleteBib !== null ? `Are you sure you want to delete couple #${deleteBib}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteId !== null) handleDeleteCouple(deleteId); setDeleteId(null); setDeleteBib(null); }}
        onCancel={() => { setDeleteId(null); setDeleteBib(null); }}
      />
    </div>
  );
};

export default CouplesTab;
