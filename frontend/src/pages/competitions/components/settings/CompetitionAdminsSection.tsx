import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { competitionsApi } from '../../../../api/client';
import { useAuth } from '../../../../context/AuthContext';
import { CompetitionAdmin, CompetitionAdminRole } from '../../../../types';
import Section from './Section';

const ROLE_LABELS: Record<CompetitionAdminRole, string> = {
  admin: 'Full Admin',
  billing: 'Billing & Invoices',
  entries: 'Entries Only',
};

const ROLE_DESCRIPTIONS: Record<CompetitionAdminRole, string> = {
  admin: 'Full access to all competition features',
  billing: 'Manage invoices, pricing, settings, and people',
  entries: 'View events and manage entries, but no invoices',
};

type EnrichedAdmin = CompetitionAdmin & { email?: string; displayName?: string; firstName?: string; lastName?: string };

interface CompetitionAdminsSectionProps {
  competitionId: number;
  savedMap: Record<string, boolean>;
  flashSaved: (key: string) => void;
}

const CompetitionAdminsSection = ({
  competitionId,
  savedMap,
  flashSaved,
}: CompetitionAdminsSectionProps) => {
  const { isAdmin } = useAuth();
  const [admins, setAdmins] = useState<EnrichedAdmin[]>([]);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<CompetitionAdminRole>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const loadAdmins = useCallback(() => {
    if (!competitionId || loadedRef.current) return;
    loadedRef.current = true;
    competitionsApi.getAdmins(competitionId)
      .then(res => setAdmins(res.data))
      .catch(() => {});
  }, [competitionId]);

  const handleAdd = async () => {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await competitionsApi.addAdmin(competitionId, email.trim(), selectedRole);
      setAdmins(prev => [...prev.filter(a => a.userUid !== res.data.userUid), res.data as EnrichedAdmin]);
      setEmail('');
      setSelectedRole('admin');
      flashSaved('admins');
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to add admin' : 'Failed to add admin');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (uid: string) => {
    try {
      await competitionsApi.removeAdmin(competitionId, uid);
      setAdmins(prev => prev.filter(a => a.userUid !== uid));
      flashSaved('admins');
    } catch {
      setError('Failed to remove admin');
    }
  };

  return (
    <Section title="Competition Admins" defaultOpen={false} savedKey="admins" savedMap={savedMap} onOpen={loadAdmins}>
      <p className="text-gray-500 text-sm mb-3">
        Competition admins can manage this competition without having full site admin access.
        {isAdmin ? '' : ' Only site admins can create new competitions.'}
      </p>

      {admins.length === 0 ? (
        <p className="text-gray-400 text-sm mb-3">No competition admins assigned yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-4 max-w-[500px]">
          {admins.map(admin => (
            <div key={admin.userUid} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {admin.displayName || `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email || admin.userUid}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {admin.email && (
                    <span className="text-xs text-gray-500">{admin.email}</span>
                  )}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    admin.role === 'admin' ? 'bg-primary-100 text-primary-700' :
                    admin.role === 'billing' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {ROLE_LABELS[admin.role as CompetitionAdminRole] || admin.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(admin.userUid)}
                className="px-2 py-1 bg-transparent border border-gray-200 rounded text-red-600 cursor-pointer text-xs hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 max-w-[600px]">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter user email..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <select
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value as CompetitionAdminRole)}
          className="px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          title={ROLE_DESCRIPTIONS[selectedRole]}
        >
          {(Object.keys(ROLE_LABELS) as CompetitionAdminRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={loading || !email.trim()}
          className={`px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 whitespace-nowrap ${loading || !email.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </Section>
  );
};

export default CompetitionAdminsSection;
