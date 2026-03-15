import { useState, useMemo } from 'react';
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
  defaultStudioId?: number;
  onDataChange: () => void;
}

const PeopleTab = ({ people, studios, competitionId, defaultStudioId, onDataChange }: PeopleTabProps) => {
  const { showToast } = useToast();
  const studioDefault: string | number = defaultStudioId || '';
  const [newPerson, setNewPerson] = useState({
    firstName: '', lastName: '', email: '',
    role: 'both' as Person['role'],
    status: 'student' as Person['status'],
    studioId: studioDefault,
  });
  const [showMbImport, setShowMbImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Person>>({});
  const [merging, setMerging] = useState(false);

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
      setNewPerson({ firstName: '', lastName: '', email: '', role: 'both', status: 'student', studioId: studioDefault });
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

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setEditValues({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email || '',
      dateOfBirth: person.dateOfBirth || '',
      role: person.role,
      status: person.status,
      studioId: person.studioId,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await peopleApi.update(editingId, {
        ...editValues,
        email: editValues.email || null as any,
        dateOfBirth: editValues.dateOfBirth || null as any,
        studioId: editValues.studioId ? Number(editValues.studioId) : null as any,
      });
      setEditingId(null);
      onDataChange();
      showToast('Person updated', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update person', 'error');
    }
  };

  const handleMerge = async (group: Person[]) => {
    // Auto-pick: prefer person with bib, then with email, then lower ID
    const sorted = [...group].sort((a, b) => {
      if (a.bib && !b.bib) return -1;
      if (!a.bib && b.bib) return 1;
      if (a.email && !b.email) return -1;
      if (!a.email && b.email) return 1;
      return a.id - b.id;
    });
    const keep = sorted[0];
    const mergeIds = sorted.slice(1).map(p => p.id);

    setMerging(true);
    try {
      for (const mergeId of mergeIds) {
        await peopleApi.merge(keep.id, mergeId);
      }
      showToast(`Merged into ${keep.firstName} ${keep.lastName} (ID:${keep.id}) with role "Both"`, 'success');
      onDataChange();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to merge', 'error');
    } finally {
      setMerging(false);
    }
  };

  // Detect potential duplicates: same first+last name (case-insensitive), different IDs
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const person of people) {
      const key = `${person.firstName.toLowerCase().trim()} ${person.lastName.toLowerCase().trim()}`;
      const list = groups.get(key) || [];
      list.push(person);
      groups.set(key, list);
    }
    return Array.from(groups.values()).filter(g => g.length > 1);
  }, [people]);

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

      {duplicateGroups.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
          <h4 className="text-amber-800 font-semibold text-sm mb-2">
            Potential Duplicates Detected ({duplicateGroups.length} {duplicateGroups.length === 1 ? 'group' : 'groups'})
          </h4>
          <p className="text-amber-700 text-xs mb-3">
            The following people share the same name. If they are the same person acting as both leader and follower, merge them into one record with role "Both".
          </p>
          {duplicateGroups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-2 flex-wrap mb-2 pb-2 border-b border-amber-200 last:border-b-0 last:mb-0 last:pb-0">
              {group.map((person, pi) => (
                <span key={person.id} className="text-sm">
                  {pi > 0 && <span className="text-amber-400 mx-1">&amp;</span>}
                  <span className="font-medium">{person.firstName} {person.lastName}</span>
                  <span className="text-xs text-amber-600 ml-1">
                    (ID:{person.id}, {person.role}, {person.status}{person.bib ? `, bib #${person.bib}` : ''})
                  </span>
                </span>
              ))}
              <button
                onClick={() => handleMerge(group)}
                disabled={merging}
                className="ml-auto px-3 py-1 bg-amber-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                {merging ? 'Merging...' : 'Merge'}
              </button>
            </div>
          ))}
        </div>
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
        <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">First Name</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Last Name</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Email</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">DOB</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Role</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Status</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Studio</th>
              <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.map(person => {
              const isEditing = editingId === person.id;
              const inputCls = "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500";
              return (
              <tr key={person.id}>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? <input type="text" value={editValues.firstName || ''} onChange={e => setEditValues({ ...editValues, firstName: e.target.value })} className={inputCls} /> : person.firstName}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? <input type="text" value={editValues.lastName || ''} onChange={e => setEditValues({ ...editValues, lastName: e.target.value })} className={inputCls} /> : person.lastName}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? <input type="email" value={editValues.email || ''} onChange={e => setEditValues({ ...editValues, email: e.target.value })} className={inputCls} /> : person.email || ''}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? <input type="date" value={editValues.dateOfBirth || ''} onChange={e => setEditValues({ ...editValues, dateOfBirth: e.target.value })} className={inputCls} /> : person.dateOfBirth || ''}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? (
                  <select value={editValues.role || ''} onChange={e => setEditValues({ ...editValues, role: e.target.value as Person['role'] })} className={inputCls}>
                    <option value="leader">Leader</option><option value="follower">Follower</option><option value="both">Both</option>
                  </select>
                ) : person.role}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? (
                  <select value={editValues.status || ''} onChange={e => setEditValues({ ...editValues, status: e.target.value as Person['status'] })} className={inputCls}>
                    <option value="student">Student</option><option value="professional">Professional</option>
                  </select>
                ) : person.status}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">{isEditing ? (
                  <select value={editValues.studioId || ''} onChange={e => setEditValues({ ...editValues, studioId: e.target.value ? Number(e.target.value) : undefined })} className={inputCls}>
                    <option value="">None</option>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : studios.find(s => s.id === person.studioId)?.name || ''}</td>
                <td className="px-3 py-2 border-b border-gray-100 text-sm">
                  {isEditing ? (
                    <div className="flex gap-1">
                      <button onClick={handleSaveEdit} className="px-2 py-1 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-success-600">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-300 text-gray-700 rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-gray-400">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(person)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">Edit</button>
                      <button onClick={() => setDeleteTarget(person)}
                        aria-label={`Delete ${person.firstName} ${person.lastName}`}
                        className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600">
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
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
