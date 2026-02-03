import { useState, useEffect } from 'react';
import { organizationsApi } from '../api/client';
import { Organization, RulePresetKey } from '../types';
import { useAuth } from '../context/AuthContext';

const presetColors: Record<RulePresetKey, { bg: string; text: string }> = {
  ndca: { bg: '#fde8e8', text: '#dc2626' },
  usadance: { bg: '#dbeafe', text: '#2563eb' },
  custom: { bg: '#e2e8f0', text: '#4a5568' },
};

const presetLabels: Record<RulePresetKey, string> = {
  ndca: 'NDCA',
  usadance: 'USA Dance',
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
                  {(['ndca', 'usadance', 'custom'] as RulePresetKey[]).map(preset => {
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
                    <button
                      onClick={() => handleDelete(org.id, org.name)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: '#fee', color: '#c00' }}
                    >
                      Delete
                    </button>
                  </div>
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
