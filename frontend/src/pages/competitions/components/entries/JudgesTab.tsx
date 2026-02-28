import { useState } from 'react';
import type { FormEvent } from 'react';
import { judgesApi } from '../../../../api/client';
import { Judge } from '../../../../types';

interface JudgesTabProps {
  judges: Judge[];
  competitionId: number;
  onDataChange: () => void;
}

const JudgesTab = ({ judges, competitionId, onDataChange }: JudgesTabProps) => {
  const [newJudgeName, setNewJudgeName] = useState('');

  const handleAddJudge = async (e: FormEvent) => {
    e.preventDefault();
    if (!newJudgeName.trim() || !competitionId) return;
    try {
      await judgesApi.create(newJudgeName.trim(), competitionId);
      setNewJudgeName('');
      onDataChange();
    } catch {
      // Error handling delegated to parent
    }
  };

  const handleDeleteJudge = async (id: number) => {
    if (!window.confirm('Delete this judge?')) return;
    try {
      await judgesApi.delete(id);
      onDataChange();
    } catch {
      alert('Failed to delete judge');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="mt-0 mb-3">Judges</h3>
      <div>
        <form onSubmit={handleAddJudge} className="mb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 mb-0">
              <label className="block text-sm font-medium text-gray-600 mb-1">Judge Name</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newJudgeName}
                onChange={e => setNewJudgeName(e.target.value)} placeholder="Enter judge name" required />
            </div>
            <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add Judge</button>
          </div>
        </form>

        {judges.length === 0 ? (
          <p className="text-center p-4 text-gray-500">No judges added yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Judge #</th>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Name</th>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map(judge => (
                <tr key={judge.id}>
                  <td className="px-3 py-2 border-b border-gray-100 text-sm"><strong>#{judge.judgeNumber}</strong></td>
                  <td className="px-3 py-2 border-b border-gray-100 text-sm">{judge.name}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-sm">
                    <button onClick={() => handleDeleteJudge(judge.id)}
                      className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
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

export default JudgesTab;
