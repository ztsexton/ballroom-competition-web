import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { judgeProfilesApi } from '../../api/client';
import { JudgeProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/Skeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const DEFAULT_STYLE_ORDER = ['Smooth', 'Rhythm', 'Standard', 'Latin'];
const CERTIFICATION_LEVELS = ['Gold', 'Novice', 'Pre-Championship', 'Championship'];

const JudgeProfilesPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<JudgeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const res = await judgeProfilesApi.getAll();
      setProfiles(res.data);
      setError('');
    } catch {
      setError('Failed to load judge profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      await judgeProfilesApi.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        certifications: {},
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setError('');
      loadProfiles();
    } catch {
      setError('Failed to add judge profile');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await judgeProfilesApi.delete(id);
      if (expandedId === id) setExpandedId(null);
      loadProfiles();
    } catch {
      showToast('Failed to delete profile', 'error');
    }
  };

  const handleCertToggle = async (profile: JudgeProfile, style: string, level: string) => {
    const certs = { ...profile.certifications };
    const styleCerts = [...(certs[style] || [])];
    const idx = styleCerts.indexOf(level);
    if (idx >= 0) {
      styleCerts.splice(idx, 1);
    } else {
      styleCerts.push(level);
    }
    if (styleCerts.length > 0) {
      certs[style] = styleCerts;
    } else {
      delete certs[style];
    }
    try {
      await judgeProfilesApi.update(profile.id, { certifications: certs });
      loadProfiles();
    } catch {
      setError('Failed to update certifications');
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

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-500">You must be a site admin to manage judge profiles.</p>
        </div>
      </div>
    );
  }

  const certSummary = (certs: Record<string, string[]>): string => {
    const entries = Object.entries(certs).filter(([, levels]) => levels.length > 0);
    if (entries.length === 0) return 'Default (up to Silver)';
    return entries.map(([style, levels]) => `${style}: ${levels.join(', ')}`).join(' | ');
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Judge Management</h2>
        <p className="text-gray-500 mt-2">
          Manage site-level judge profiles with qualification certifications.
          All judges can judge Newcomer, Bronze, and Silver in all styles by default.
        </p>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded mb-4 text-sm mt-3">{error}</div>}

        <form onSubmit={handleAdd} className="mt-6">
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                required
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                required
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Optional"
                className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600">
              Add Judge
            </button>
          </div>
        </form>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center py-8 text-gray-500">
          <h3 className="font-semibold mb-1">No judge profiles yet</h3>
          <p>Add your first judge profile using the form above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium border-b border-gray-200">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium border-b border-gray-200">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium border-b border-gray-200">Certifications</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <>
                  <tr key={profile.id}>
                    <td className="px-4 py-3 border-t border-gray-100 font-medium">
                      {profile.firstName} {profile.lastName}
                    </td>
                    <td className="px-4 py-3 border-t border-gray-100 text-gray-600">
                      {profile.email || '-'}
                    </td>
                    <td className="px-4 py-3 border-t border-gray-100 text-gray-600 text-xs">
                      {certSummary(profile.certifications)}
                    </td>
                    <td className="px-4 py-3 border-t border-gray-100">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                        >
                          {expandedId === profile.id ? 'Close' : 'Qualifications'}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(profile.id)}
                          className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === profile.id && (
                    <tr key={`${profile.id}-certs`}>
                      <td colSpan={4} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-3">
                          Check the levels this judge is certified to judge beyond Silver.
                        </div>
                        <table className="text-sm">
                          <thead>
                            <tr>
                              <th className="text-left pr-6 pb-2 text-gray-500 font-medium">Style</th>
                              {CERTIFICATION_LEVELS.map(level => (
                                <th key={level} className="text-center px-3 pb-2 text-gray-500 font-medium">{level}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {DEFAULT_STYLE_ORDER.map(style => (
                              <tr key={style}>
                                <td className="pr-6 py-1 font-medium text-gray-700">{style}</td>
                                {CERTIFICATION_LEVELS.map(level => (
                                  <td key={level} className="text-center px-3 py-1">
                                    <input
                                      type="checkbox"
                                      checked={profile.certifications[style]?.includes(level) || false}
                                      onChange={() => handleCertToggle(profile, style, level)}
                                      className="w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Judge Profile"
        message="Delete this judge profile? This will unlink it from any competition judges."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget !== null) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default JudgeProfilesPage;
