import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { competitionsApi } from '../../../../api/client';
import { useAuth } from '../../../../context/AuthContext';
import { CompetitionAdmin } from '../../../../types';
import Section from './Section';

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
      const res = await competitionsApi.addAdmin(competitionId, email.trim());
      setAdmins(prev => [...prev.filter(a => a.userUid !== res.data.userUid), res.data as EnrichedAdmin]);
      setEmail('');
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
                {admin.email && (
                  <div className="text-xs text-gray-500">{admin.email}</div>
                )}
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

      <div className="flex gap-2 max-w-[500px]">
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
        <button
          onClick={handleAdd}
          disabled={loading || !email.trim()}
          className={`px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 ${loading || !email.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Adding...' : 'Add Admin'}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </Section>
  );
};

export default CompetitionAdminsSection;
