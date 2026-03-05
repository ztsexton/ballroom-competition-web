import { useState } from 'react';
import axios from 'axios';
import { mindbodyApi } from '../../../../api/client';
import { useToast } from '../../../../context/ToastContext';
import { Studio, Person, MindbodyClient } from '../../../../types';

interface MindBodyImportPanelProps {
  studios: Studio[];
  competitionId: number;
  onImportComplete: () => void;
}

const MindBodyImportPanel = ({ studios, competitionId, onImportComplete }: MindBodyImportPanelProps) => {
  const { showToast } = useToast();
  const [mbStudioId, setMbStudioId] = useState<number | ''>('');
  const [mbSearchText, setMbSearchText] = useState('');
  const [mbClients, setMbClients] = useState<MindbodyClient[]>([]);
  const [mbSelected, setMbSelected] = useState<Set<string>>(new Set());
  const [mbLoading, setMbLoading] = useState(false);
  const [mbImporting, setMbImporting] = useState(false);
  const [mbError, setMbError] = useState('');
  const [mbRole, setMbRole] = useState<Person['role']>('both');
  const [mbStatus, setMbStatus] = useState<Person['status']>('student');

  const connectedStudios = studios.filter(s => !!s.mindbodySiteId);

  const handleMbSearch = async () => {
    if (!mbStudioId) return;
    setMbLoading(true);
    setMbError('');
    try {
      const res = await mindbodyApi.getClients(mbStudioId as number, {
        searchText: mbSearchText || undefined,
        limit: 200,
      });
      setMbClients(res.data.clients);
      setMbSelected(new Set());
    } catch (err: unknown) {
      setMbError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to fetch clients' : 'Failed to fetch clients');
      setMbClients([]);
    } finally {
      setMbLoading(false);
    }
  };

  const handleMbToggle = (id: string) => {
    setMbSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMbSelectAll = () => {
    if (mbSelected.size === mbClients.length) {
      setMbSelected(new Set());
    } else {
      setMbSelected(new Set(mbClients.map(c => c.id)));
    }
  };

  const handleMbImport = async () => {
    if (!mbStudioId || mbSelected.size === 0 || !competitionId) return;
    setMbImporting(true);
    setMbError('');
    try {
      const clients = mbClients
        .filter(c => mbSelected.has(c.id))
        .map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          role: mbRole,
          status: mbStatus,
        }));
      const res = await mindbodyApi.importClients(mbStudioId as number, competitionId, clients);
      showToast(`Imported ${res.data.imported} people.`, 'success');
      setMbClients([]);
      setMbSelected(new Set());
      onImportComplete();
    } catch (err: unknown) {
      setMbError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to import clients' : 'Failed to import clients');
    } finally {
      setMbImporting(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
      <h4 className="mt-0 mb-3">Import from MindBody</h4>
      {mbError && <div className="text-danger-500 mt-2 mb-3">{mbError}</div>}

      <div className="flex gap-3 items-end flex-wrap mb-3">
        <div className="mb-0 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Studio</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbStudioId} onChange={e => setMbStudioId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select Studio</option>
            {connectedStudios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-0 flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search (name, email, phone)</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            type="text"
            value={mbSearchText}
            onChange={e => setMbSearchText(e.target.value)}
            placeholder="Leave blank to fetch all"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMbSearch(); } }}
          />
        </div>
        <button
          className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-primary-600 mb-0"
          disabled={!mbStudioId || mbLoading}
          onClick={handleMbSearch}
        >
          {mbLoading ? 'Loading...' : 'Fetch Clients'}
        </button>
      </div>

      {mbClients.length > 0 && (
        <>
          <div className="flex gap-3 items-end flex-wrap mb-3">
            <div className="mb-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Role for imports</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbRole} onChange={e => setMbRole(e.target.value as Person['role'])}>
                <option value="both">Both</option>
                <option value="leader">Leader</option>
                <option value="follower">Follower</option>
              </select>
            </div>
            <div className="mb-0">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status for imports</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" value={mbStatus} onChange={e => setMbStatus(e.target.value as Person['status'])}>
                <option value="student">Student</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            <button
              className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium transition-colors hover:bg-primary-600 mb-0"
              disabled={mbSelected.size === 0 || mbImporting}
              onClick={handleMbImport}
            >
              {mbImporting ? 'Importing...' : `Import Selected (${mbSelected.size})`}
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto border border-gray-200 rounded-md">
            <table className="w-full border-collapse m-0">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm w-10">
                    <input
                      type="checkbox"
                      checked={mbSelected.size === mbClients.length && mbClients.length > 0}
                      onChange={handleMbSelectAll}
                    />
                  </th>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Name</th>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Email</th>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Phone</th>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Active</th>
                  <th className="text-left px-3 py-2 bg-gray-50 font-semibold text-sm">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {mbClients.map(client => (
                  <tr key={client.id} className={client.isActive ? 'opacity-100' : 'opacity-50'}>
                    <td className="px-3 py-2 border-b border-gray-100 text-sm">
                      <input
                        type="checkbox"
                        checked={mbSelected.has(client.id)}
                        onChange={() => handleMbToggle(client.id)}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 text-sm">{client.firstName} {client.lastName}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.email || '-'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.phone || '-'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-sm">{client.isActive ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs">{client.lastActivityDate || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {mbClients.length} clients loaded. {mbSelected.size} selected.
          </p>
        </>
      )}
    </div>
  );
};

export default MindBodyImportPanel;
