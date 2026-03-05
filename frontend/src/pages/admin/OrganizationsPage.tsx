import { useState, useEffect } from 'react';
import axios from 'axios';
import { organizationsApi } from '../../api/client';
import { Organization, RulePresetKey, AgeCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AGE_CATEGORY_PRESETS } from '../../constants/ageCategories';
import { Skeleton } from '../../components/Skeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const presetColorCls: Record<RulePresetKey, { bg: string; text: string }> = {
  ndca: { bg: 'bg-red-100', text: 'text-red-600' },
  usadance: { bg: 'bg-blue-100', text: 'text-blue-600' },
  wdc: { bg: 'bg-green-100', text: 'text-green-600' },
  wdsf: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  custom: { bg: 'bg-gray-200', text: 'text-gray-600' },
};

const presetBtnActive: Record<RulePresetKey, string> = {
  ndca: 'border-2 border-red-600 bg-red-600 text-white font-bold',
  usadance: 'border-2 border-blue-600 bg-blue-600 text-white font-bold',
  wdc: 'border-2 border-green-600 bg-green-600 text-white font-bold',
  wdsf: 'border-2 border-yellow-600 bg-yellow-600 text-white font-bold',
  custom: 'border-2 border-gray-600 bg-gray-600 text-white font-bold',
};

const presetLabels: Record<RulePresetKey, string> = {
  ndca: 'NDCA',
  usadance: 'USA Dance',
  wdc: 'WDC',
  wdsf: 'WDSF',
  custom: 'Custom',
};

const OrganizationsPage = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const [formName, setFormName] = useState('');
  const [formPreset, setFormPreset] = useState<RulePresetKey>('custom');
  const [editingAgeCatsOrgId, setEditingAgeCatsOrgId] = useState<number | null>(null);
  const [editableAgeCats, setEditableAgeCats] = useState<AgeCategory[]>([]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await organizationsApi.getAll();
      setOrganizations(res.data);
    } catch {
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await organizationsApi.create({
        name: formName,
        rulePresetKey: formPreset,
        settings: {},
      });
      setFormName('');
      setFormPreset('custom');
      setShowForm(false);
      loadOrganizations();
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to create organization' : 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await organizationsApi.delete(id);
      loadOrganizations();
    } catch {
      showToast('Failed to delete organization', 'error');
    }
  };

  const startEditingAgeCats = (org: Organization) => {
    setEditingAgeCatsOrgId(org.id);
    setEditableAgeCats(org.settings.ageCategories ? [...org.settings.ageCategories.map(c => ({ ...c }))] : []);
  };

  const saveAgeCats = async (orgId: number) => {
    const org = organizations.find(o => o.id === orgId);
    if (!org) return;
    try {
      await organizationsApi.update(orgId, {
        settings: { ...org.settings, ageCategories: editableAgeCats },
      });
      setEditingAgeCatsOrgId(null);
      loadOrganizations();
    } catch {
      setError('Failed to save age categories');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <Skeleton className="h-8 w-56 mb-6" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage organizations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2>Organizations</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
          >
            {showForm ? 'Cancel' : '+ New Organization'}
          </button>
        </div>

        {error && <div className="px-4 py-3 bg-red-100 text-red-700 rounded text-sm mb-4">{error}</div>}

        {showForm && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 mb-6">
            <h3 className="mt-0">Create New Organization</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input
                  id="orgName"
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g., NDCA Region 1, My Studio Comp"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Preset *</label>
                <div className="flex gap-2 flex-wrap">
                  {(['ndca', 'usadance', 'wdc', 'wdsf', 'custom'] as RulePresetKey[]).map(preset => {
                    const isActive = formPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormPreset(preset)}
                        className={`px-4 py-2 rounded cursor-pointer transition-all ${
                          isActive
                            ? presetBtnActive[preset]
                            : 'border border-gray-300 bg-white text-gray-700 font-normal'
                        }`}
                      >
                        {presetLabels[preset]}
                      </button>
                    );
                  })}
                </div>
                <small className="text-gray-500 mt-1 block">
                  {formPreset === 'ndca' && 'NDCA defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'usadance' && 'USA Dance defaults: Newcomer through Championship levels, standard scoring, 6 couples/heat.'}
                  {formPreset === 'wdc' && 'WDC defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'wdsf' && 'WDSF defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'custom' && 'Start with a blank slate and configure your own rules.'}
                </small>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Organization'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {organizations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No organizations yet</p>
            <p>Create an organization to define rule presets and default settings for your competitions.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {organizations.map(org => {
              const colors = presetColorCls[org.rulePresetKey] || presetColorCls.custom;
              return (
                <div
                  key={org.id}
                  className="border border-gray-200 rounded-lg p-5 bg-white"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="m-0">{org.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                          {presetLabels[org.rulePresetKey] || org.rulePresetKey}
                        </span>
                      </div>

                      {/* Settings summary */}
                      <div className="text-sm text-gray-500">
                        {org.settings.defaultLevels && org.settings.defaultLevels.length > 0 && (
                          <p className="my-1">
                            Levels: {org.settings.defaultLevels.join(', ')}
                          </p>
                        )}
                        {org.settings.defaultScoringType && (
                          <span className="mr-4">
                            Scoring: {org.settings.defaultScoringType}
                          </span>
                        )}
                        {org.settings.defaultMaxCouplesPerHeat && (
                          <span>
                            Max couples/heat: {org.settings.defaultMaxCouplesPerHeat}
                          </span>
                        )}
                        {org.settings.ageCategories && org.settings.ageCategories.length > 0 && (
                          <p className="my-1">
                            Age categories: {org.settings.ageCategories.map(ac => ac.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingAgeCatsOrgId !== org.id && (
                        <button
                          onClick={() => startEditingAgeCats(org)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
                        >
                          Edit Age Categories
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget({ id: org.id, name: org.name })}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded border border-red-200 cursor-pointer text-xs font-medium transition-colors hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Age category inline editor */}
                  {editingAgeCatsOrgId === org.id && (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                      <div className="flex justify-between items-center mb-3">
                        <strong>Age Categories</strong>
                        <div className="flex gap-2">
                          {AGE_CATEGORY_PRESETS[org.rulePresetKey] && (
                            <button
                              type="button"
                              onClick={() => setEditableAgeCats(AGE_CATEGORY_PRESETS[org.rulePresetKey].map(c => ({ ...c })))}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
                            >
                              Reset to {presetLabels[org.rulePresetKey]} Defaults
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditableAgeCats([...editableAgeCats, { name: '' }])}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-xs font-medium transition-colors hover:bg-gray-200"
                          >
                            + Add
                          </button>
                        </div>
                      </div>

                      {editableAgeCats.length === 0 ? (
                        <p className="text-gray-400 text-center p-2">No age categories configured</p>
                      ) : (
                        <div className="grid gap-2">
                          {editableAgeCats.map((cat, idx) => (
                            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                              <input
                                type="text"
                                value={cat.name}
                                placeholder="Name"
                                onChange={e => {
                                  const updated = [...editableAgeCats];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setEditableAgeCats(updated);
                                }}
                                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                              <input
                                type="number"
                                value={cat.minAge ?? ''}
                                placeholder="Min age"
                                onChange={e => {
                                  const updated = [...editableAgeCats];
                                  updated[idx] = { ...updated[idx], minAge: e.target.value ? parseInt(e.target.value) : undefined };
                                  setEditableAgeCats(updated);
                                }}
                                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                              <input
                                type="number"
                                value={cat.maxAge ?? ''}
                                placeholder="Max age"
                                onChange={e => {
                                  const updated = [...editableAgeCats];
                                  updated[idx] = { ...updated[idx], maxAge: e.target.value ? parseInt(e.target.value) : undefined };
                                  setEditableAgeCats(updated);
                                }}
                                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                              <button
                                type="button"
                                onClick={() => setEditableAgeCats(editableAgeCats.filter((_, i) => i !== idx))}
                                className="px-2 py-1 bg-transparent border border-gray-200 rounded text-danger-500 cursor-pointer text-sm transition-colors hover:bg-red-50"
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => saveAgeCats(org.id)}
                          className="px-4 py-1.5 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAgeCatsOrgId(null)}
                          className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Organization"
        message={`Delete organization "${deleteTarget?.name}"? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default OrganizationsPage;
