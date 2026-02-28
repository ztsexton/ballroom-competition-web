import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { couplesApi } from '../../../../api/client';
import { Person, Couple, Competition } from '../../../../types';
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
  const [leaderId, setLeaderId] = useState('');
  const [followerId, setFollowerId] = useState('');
  const [coupleError, setCoupleError] = useState('');

  const registration = useRegistrationPanel(competitionId, activeCompetition);

  const leaders = people.filter(p => p.role === 'leader' || p.role === 'both');
  const followers = people.filter(p => p.role === 'follower' || p.role === 'both');

  const handleAddCouple = async (e: FormEvent) => {
    e.preventDefault();
    if (!leaderId || !followerId || !competitionId) return;
    try {
      await couplesApi.create(parseInt(leaderId), parseInt(followerId), competitionId);
      setLeaderId('');
      setFollowerId('');
      setCoupleError('');
      onDataChange();
    } catch (err: unknown) {
      setCoupleError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add couple' : 'Failed to add couple');
    }
  };

  const handleDeleteCouple = async (bib: number) => {
    if (!window.confirm('Delete this couple?')) return;
    try {
      await couplesApi.delete(bib);
      setCoupleError('');
      onDataChange();
    } catch (err: unknown) {
      alert(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to delete couple' : 'Failed to delete couple');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="mt-0 mb-3">Couples</h3>
      <div>
        {coupleError && <div className="text-danger-500 mt-2 mb-2">{coupleError}</div>}

        {people.length === 0 ? (
          <p className="text-gray-500 p-4 text-center">
            Add people first before creating couples.
          </p>
        ) : (
          <form onSubmit={handleAddCouple} className="mb-4">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="mb-0">
                <label className="block text-sm font-medium text-gray-600 mb-1">Leader</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={leaderId} onChange={e => setLeaderId(e.target.value)} required>
                  <option value="">Select Leader</option>
                  {leaders.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-0">
                <label className="block text-sm font-medium text-gray-600 mb-1">Follower</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={followerId} onChange={e => setFollowerId(e.target.value)} required>
                  <option value="">Select Follower</option>
                  {followers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.status === 'professional' ? '(Pro)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add Couple</button>
            </div>
          </form>
        )}

        {couples.length === 0 ? (
          <p className="text-center p-4 text-gray-500">No couples created yet.</p>
        ) : (
          <div>
            {couples.map(couple => {
              const isOpen = registration.registerBib === couple.bib;

              return (
                <div key={couple.bib} className="border-b border-gray-200">
                  <div className="flex items-center py-2.5 gap-4">
                    <strong className="min-w-[3rem]">#{couple.bib}</strong>
                    <span className="flex-1">{couple.leaderName} & {couple.followerName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => registration.openRegisterPanel(couple.bib)}
                        className={`px-2 py-1 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors ${isOpen ? 'bg-primary-700 hover:bg-primary-800' : 'bg-primary-500 hover:bg-primary-600'}`}
                      >
                        {isOpen ? 'Close' : 'Register'}
                      </button>
                      <button
                        onClick={() => handleDeleteCouple(couple.bib)}
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
    </div>
  );
};

export default CouplesTab;
