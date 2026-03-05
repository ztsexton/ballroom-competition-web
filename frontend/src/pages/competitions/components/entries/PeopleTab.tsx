import { useState } from 'react';
import type { FormEvent } from 'react';
import { peopleApi } from '../../../../api/client';
import { Person, Studio } from '../../../../types';
import { useToast } from '../../../../context/ToastContext';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import MindBodyImportPanel from './MindBodyImportPanel';

interface PeopleTabProps {
  people: Person[];
  studios: Studio[];
  competitionId: number;
  onDataChange: () => void;
}

const PeopleTab = ({ people, studios, competitionId, onDataChange }: PeopleTabProps) => {
  const { showToast } = useToast();
  const [newPerson, setNewPerson] = useState({
    firstName: '', lastName: '', email: '',
    role: 'both' as Person['role'],
    status: 'student' as Person['status'],
    studioId: '' as string | number,
  });
  const [showMbImport, setShowMbImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  const connectedStudios = studios.filter(s => !!s.mindbodySiteId);

  const handleAddPerson = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPerson.firstName || !newPerson.lastName || !competitionId) return;
    try {
      await peopleApi.create({
        ...newPerson,
        studioId: newPerson.studioId ? Number(newPerson.studioId) : undefined,
        email: newPerson.email || undefined,
        competitionId,
      });
      setNewPerson({ firstName: '', lastName: '', email: '', role: 'both', status: 'student', studioId: '' });
      onDataChange();
    } catch {
      // Error handling delegated to parent via onDataChange
    }
  };

  const handleDeletePerson = async (id: number) => {
    try {
      await peopleApi.delete(id);
      onDataChange();
    } catch {
      showToast('Failed to delete person', 'error');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0">People</h3>
        {connectedStudios.length > 0 && (
          <button
            className="px-3 py-1.5 bg-gray-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-gray-600"
            onClick={() => setShowMbImport(!showMbImport)}
          >
            {showMbImport ? 'Close Import' : 'Import from MindBody'}
          </button>
        )}
      </div>

      {showMbImport && (
        <MindBodyImportPanel
          studios={studios}
          competitionId={competitionId}
          onImportComplete={() => {
            setShowMbImport(false);
            onDataChange();
          }}
        />
      )}

      <form onSubmit={handleAddPerson} className="mb-4">
        <div className="grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr_1fr_auto] gap-2 items-end">
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newPerson.firstName}
              onChange={e => setNewPerson({ ...newPerson, firstName: e.target.value })} required />
          </div>
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="text" value={newPerson.lastName}
              onChange={e => setNewPerson({ ...newPerson, lastName: e.target.value })} required />
          </div>
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" type="email" value={newPerson.email}
              onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
          </div>
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.role}
              onChange={e => setNewPerson({ ...newPerson, role: e.target.value as Person['role'] })}>
              <option value="leader">Leader</option>
              <option value="follower">Follower</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.status}
              onChange={e => setNewPerson({ ...newPerson, status: e.target.value as Person['status'] })}>
              <option value="student">Student</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          <div className="mb-0">
            <label className="block text-sm font-medium text-gray-600 mb-1">Studio</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={newPerson.studioId}
              onChange={e => setNewPerson({ ...newPerson, studioId: e.target.value })}>
              <option value="">None</option>
              {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 mb-0">Add</button>
        </div>
      </form>

      {people.length === 0 ? (
        <p className="text-center p-4 text-gray-500">No people added yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">First Name</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Last Name</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Email</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Role</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Status</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Studio</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map(person => (
              <tr key={person.id}>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.firstName}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.lastName}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.email || ''}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.role}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{person.status}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{studios.find(s => s.id === person.studioId)?.name || ''}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">
                  <button onClick={() => setDeleteTarget(person)}
                    aria-label={`Delete ${person.firstName} ${person.lastName}`}
                    className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Person"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.firstName} ${deleteTarget.lastName}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDeletePerson(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default PeopleTab;
