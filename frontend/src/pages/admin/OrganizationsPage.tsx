import { useState, useEffect } from 'react';
import { organizationsApi } from '../../api/client';
import { Organization, RulePresetKey, AgeCategory } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AGE_CATEGORY_PRESETS } from '../../constants/ageCategories';

const presetColors: Record<RulePresetKey, { bg: string; text: string }> = {
  ndca: { bg: '#fde8e8', text: '#dc2626' },
  usadance: { bg: '#dbeafe', text: '#2563eb' },
  wdc: { bg: '#d1fae5', text: '#059669' },
  wdsf: { bg: '#fef3c7', text: '#d97706' },
  custom: { bg: '#e2e8f0', text: '#4a5568' },
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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete organization "${name}"? This cannot be undone.`)) return;
    try {
      await organizationsApi.delete(id);
      loadOrganizations();
    } catch {
      setError('Failed to delete organization');
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

  if (authLoading || loading) return <div className="loading">Loading...</div>;

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage organizations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Organizations</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn">
            {showForm ? 'Cancel' : '+ New Organization'}
          </button>
        </div>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {showForm && (
          <div style={{
            background: '#f7fafc',
            border: '1px solid #cbd5e0',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ marginTop: 0 }}>Create New Organization</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="orgName">Organization Name *</label>
                <input
                  id="orgName"
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g., NDCA Region 1, My Studio Comp"
                  required
                />
              </div>

              <div className="form-group">
                <label>Rule Preset *</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['ndca', 'usadance', 'wdc', 'wdsf', 'custom'] as RulePresetKey[]).map(preset => {
                    const colors = presetColors[preset];
                    const isActive = formPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormPreset(preset)}
                        style={{
                          padding: '0.5rem 1rem',
                          border: isActive ? `2px solid ${colors.text}` : '1px solid #cbd5e0',
                          borderRadius: '4px',
                          background: isActive ? colors.text : 'white',
                          color: isActive ? 'white' : '#2d3748',
                          cursor: 'pointer',
                          fontWeight: isActive ? 'bold' : 'normal',
                          transition: 'all 0.2s',
                        }}
                      >
                        {presetLabels[preset]}
                      </button>
                    );
                  })}
                </div>
                <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
                  {formPreset === 'ndca' && 'NDCA defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'usadance' && 'USA Dance defaults: Newcomer through Championship levels, standard scoring, 6 couples/heat.'}
                  {formPreset === 'wdc' && 'WDC defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'wdsf' && 'WDSF defaults: Bronze through Championship levels, standard scoring, 7 couples/heat.'}
                  {formPreset === 'custom' && 'Start with a blank slate and configure your own rules.'}
                </small>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Organization'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {organizations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>No organizations yet</p>
            <p>Create an organization to define rule presets and default settings for your competitions.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {organizations.map(org => {
              const colors = presetColors[org.rulePresetKey] || presetColors.custom;
              return (
                <div
                  key={org.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    background: 'white',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>{org.name}</h3>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: colors.bg,
                          color: colors.text,
                        }}>
                          {presetLabels[org.rulePresetKey] || org.rulePresetKey}
                        </span>
                      </div>

                      {/* Settings summary */}
                      <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                        {org.settings.defaultLevels && org.settings.defaultLevels.length > 0 && (
                          <p style={{ margin: '0.25rem 0' }}>
                            Levels: {org.settings.defaultLevels.join(', ')}
                          </p>
                        )}
                        {org.settings.defaultScoringType && (
                          <span style={{ marginRight: '1rem' }}>
                            Scoring: {org.settings.defaultScoringType}
                          </span>
                        )}
                        {org.settings.defaultMaxCouplesPerHeat && (
                          <span>
                            Max couples/heat: {org.settings.defaultMaxCouplesPerHeat}
                          </span>
                        )}
                        {org.settings.ageCategories && org.settings.ageCategories.length > 0 && (
                          <p style={{ margin: '0.25rem 0' }}>
                            Age categories: {org.settings.ageCategories.map(ac => ac.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {editingAgeCatsOrgId !== org.id && (
                        <button
                          onClick={() => startEditingAgeCats(org)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                        >
                          Edit Age Categories
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(org.id, org.name)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: '#fee', color: '#c00' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Age category inline editor */}
                  {editingAgeCatsOrgId === org.id && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: '#f7fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong>Age Categories</strong>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {AGE_CATEGORY_PRESETS[org.rulePresetKey] && (
                            <button
                              type="button"
                              onClick={() => setEditableAgeCats(AGE_CATEGORY_PRESETS[org.rulePresetKey].map(c => ({ ...c })))}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              Reset to {presetLabels[org.rulePresetKey]} Defaults
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditableAgeCats([...editableAgeCats, { name: '' }])}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            + Add
                          </button>
                        </div>
                      </div>

                      {editableAgeCats.length === 0 ? (
                        <p style={{ color: '#a0aec0', textAlign: 'center', padding: '0.5rem' }}>No age categories configured</p>
                      ) : (
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {editableAgeCats.map((cat, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={cat.name}
                                placeholder="Name"
                                onChange={e => {
                                  const updated = [...editableAgeCats];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setEditableAgeCats(updated);
                                }}
                                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
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
                                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
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
                                style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
                              />
                              <button
                                type="button"
                                onClick={() => setEditableAgeCats(editableAgeCats.filter((_, i) => i !== idx))}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: 'none',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  color: '#e53e3e',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                }}
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => saveAgeCats(org.id)}
                          className="btn"
                          style={{ fontSize: '0.875rem', padding: '0.375rem 1rem' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAgeCatsOrgId(null)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.875rem', padding: '0.375rem 1rem' }}
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
    </div>
  );
};

export default OrganizationsPage;
