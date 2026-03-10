import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { competitionsApi, databaseApi, isStagingBypassActive, setStagingBypassActive } from '../../api/client';
import { Competition } from '../../types';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { Skeleton } from '../../components/Skeleton';

const AdminDashboardPage = () => {
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [stagingBypass, setStagingBypass] = useState(isStagingBypassActive());
  const [stagingAllowed, setStagingAllowed] = useState(false);
  const [togglingBypass, setTogglingBypass] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'downloading' | 'restoring'>('idle');
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAnyAdmin) {
      setLoading(false);
      return;
    }
    competitionsApi.getAll()
      .then(res => setCompetitions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAnyAdmin]);

  // Check if staging mode is allowed on this server
  useEffect(() => {
    if (!isAdmin) return;
    databaseApi.getStagingBypass()
      .then(res => {
        setStagingAllowed(res.data.allowed);
        setStagingBypass(res.data.enabled);
      })
      .catch(() => {});
  }, [isAdmin]);

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to access this page.</p>
        </div>
      </div>
    );
  }

  const sorted = [...competitions].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Admin Dashboard</h2>
        <p className="text-gray-500">
          Manage competitions and site settings.
        </p>
      </div>

      {/* Site Administration — only for full site admins */}
      {isAdmin && (
        <div className="mb-6">
          <h3 className="text-gray-600 font-semibold mb-3">Site Administration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Link
              to="/users"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Users</div>
              <p className="text-sm text-gray-500 m-0">Manage user accounts and admin access</p>
            </Link>
            <Link
              to="/studios"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Studios</div>
              <p className="text-sm text-gray-500 m-0">Manage dance studios and MindBody integrations</p>
            </Link>
            <Link
              to="/organizations"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Organizations</div>
              <p className="text-sm text-gray-500 m-0">Manage competition organizations and rule presets</p>
            </Link>
            <Link
              to="/site-settings"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Site Settings</div>
              <p className="text-sm text-gray-500 m-0">Global defaults for judge breaks and scheduling</p>
            </Link>
            <Link
              to="/judge-profiles"
              className="bg-white rounded-lg shadow p-5 no-underline text-inherit transition-shadow hover:shadow-md"
            >
              <div className="font-semibold text-gray-800 mb-1">Judges</div>
              <p className="text-sm text-gray-500 m-0">Manage judge profiles and qualifications</p>
            </Link>
            {stagingAllowed && (
              <div className={`rounded-lg shadow p-5 ${stagingBypass ? 'bg-amber-50 border border-amber-300' : 'bg-white'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-gray-800">Staging Mode</div>
                  <button
                    onClick={async () => {
                      setTogglingBypass(true);
                      try {
                        const newValue = !stagingBypass;
                        await databaseApi.setStagingBypass(newValue);
                        setStagingBypassActive(newValue);
                        setStagingBypass(newValue);
                        setTogglingBypass(false);
                        if (!newValue) {
                          window.location.reload();
                        }
                      } catch {
                        setTogglingBypass(false);
                      }
                    }}
                    disabled={togglingBypass}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-none disabled:opacity-50 ${stagingBypass ? 'bg-amber-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${stagingBypass ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-sm text-gray-500 m-0">
                  {stagingBypass
                    ? 'Auth bypassed — all requests treated as admin. Resets on restart.'
                    : 'Skip authentication for testing. Resets on server restart.'}
                </p>
              </div>
            )}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="font-semibold text-gray-800 mb-1">Backups</div>
              <p className="text-sm text-gray-500 m-0 mb-3">Download a full backup or restore from one</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBackupStatus('downloading');
                    setRestoreMessage(null);
                    try {
                      const res = await databaseApi.downloadBackup();
                      const blob = new Blob([res.data], { type: 'application/gzip' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch { /* ignore */ }
                    setBackupStatus('idle');
                  }}
                  disabled={backupStatus !== 'idle'}
                  className="px-3 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {backupStatus === 'downloading' ? 'Exporting...' : 'Download'}
                </button>
                <label className={`px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors ${backupStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-300'}`}>
                  {backupStatus === 'restoring' ? 'Restoring...' : 'Restore'}
                  <input
                    type="file"
                    accept=".gz,.json"
                    className="hidden"
                    disabled={backupStatus !== 'idle'}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!window.confirm('This will replace ALL existing data with the backup. Are you sure?')) {
                        e.target.value = '';
                        return;
                      }
                      setBackupStatus('restoring');
                      setRestoreMessage(null);
                      try {
                        const res = await databaseApi.restoreBackup(file);
                        setRestoreMessage(res.data.message);
                        window.location.reload();
                      } catch {
                        setRestoreMessage('Restore failed. Check server logs.');
                      }
                      setBackupStatus('idle');
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {restoreMessage && (
                <p className="text-xs text-green-700 mt-2 m-0">{restoreMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Competitions */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-600 font-semibold">
            Competitions ({sorted.length})
          </h3>
          {isAdmin && (
            <Link
              to="/competitions"
              className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              + New Competition
            </Link>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12 px-6">
            <h3 className="text-gray-500 mb-2">No competitions</h3>
            <p className="text-gray-400">
              {isAdmin ? 'Create your first competition to get started.' : 'You have not been assigned to any competitions yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(comp => (
              <Link
                key={comp.id}
                to={`/competitions/${comp.id}`}
                className="flex items-center gap-4 px-5 py-4 bg-white rounded-lg shadow no-underline text-inherit transition-shadow hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-[1.0625rem] mb-1">
                    {comp.name}
                  </div>
                  <div className="flex gap-3 items-center text-sm text-gray-500">
                    <CompetitionTypeBadge type={comp.type} />
                    <span>{new Date(comp.date).toLocaleDateString()}</span>
                    {comp.location && <span>{comp.location}</span>}
                  </div>
                </div>
                <span className="text-primary-500 font-semibold">
                  Manage &rsaquo;
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
