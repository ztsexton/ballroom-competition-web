import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { competitionsApi, studiosApi, organizationsApi } from '../../api/client';
import { Competition, CompetitionType, Studio, Organization } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCompetition } from '../../context/CompetitionContext';
import { DEFAULT_LEVELS, LEVEL_TEMPLATES } from '../../constants/levels';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';

const CompetitionsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isAnyAdmin, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { refreshCompetitions } = useCompetition();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{id: number; name: string} | null>(null);

  const [levels, setLevels] = useState<string[]>([...DEFAULT_LEVELS]);
  const [newLevelName, setNewLevelName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'UNAFFILIATED' as CompetitionType,
    date: new Date().toISOString().split('T')[0],
    location: '',
    studioId: '',
    organizationId: '',
    description: '',
    defaultScoringType: 'standard' as 'standard' | 'proficiency',
    websiteUrl: '',
    organizerEmail: '',
  });

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading, isAdmin]);

  const loadData = async () => {
    try {
      const compsRes = await competitionsApi.getAll();
      setCompetitions(compsRes.data);

      // Studios and organizations are site-admin-only
      if (isAdmin) {
        const [studiosRes, orgsRes] = await Promise.all([
          studiosApi.getAll(),
          organizationsApi.getAll(),
        ]);
        setStudios(studiosRes.data);
        setOrganizations(orgsRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load competitions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.type || !formData.date) {
      setError('Name, type, and date are required');
      return;
    }

    if (formData.type === 'STUDIO' && !formData.studioId) {
      setError('Studio is required for studio competitions');
      return;
    }

    setSubmitting(true);
    try {
      await competitionsApi.create({
        name: formData.name,
        type: formData.type,
        date: formData.date,
        location: formData.location || undefined,
        studioId: formData.studioId ? parseInt(formData.studioId) : undefined,
        organizationId: formData.organizationId ? parseInt(formData.organizationId) : undefined,
        description: formData.description || undefined,
        defaultScoringType: formData.defaultScoringType,
        levels,
        websiteUrl: formData.websiteUrl || undefined,
        organizerEmail: formData.organizerEmail || undefined,
      });

      setFormData({
        name: '',
        type: 'UNAFFILIATED',
        date: new Date().toISOString().split('T')[0],
        location: '',
        studioId: '',
        organizationId: '',
        description: '',
        defaultScoringType: 'standard',
        websiteUrl: '',
        organizerEmail: '',
      });
      setLevels([...DEFAULT_LEVELS]);
      setNewLevelName('');
      setShowForm(false);
      loadData();
      refreshCompetitions();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create competition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await competitionsApi.delete(id);
      loadData();
      refreshCompetitions();
    } catch (error) {
      showToast('Failed to delete competition', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getTypeLabel = (type: CompetitionType) => {
    const labels: Record<CompetitionType, string> = {
      'NDCA': 'NDCA',
      'USA_DANCE': 'USA Dance',
      'WDC': 'WDC',
      'WDSF': 'WDSF',
      'UNAFFILIATED': 'Unaffiliated',
      'STUDIO': 'Studio',
    };
    return labels[type];
  };

  const getTypeColor = (type: CompetitionType) => {
    const colors: Record<CompetitionType, string> = {
      'NDCA': '#dc2626',
      'USA_DANCE': '#2563eb',
      'WDC': '#059669',
      'WDSF': '#d97706',
      'UNAFFILIATED': '#6b7280',
      'STUDIO': '#7c3aed',
    };
    return colors[type];
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!isAnyAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage competitions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2>Competitions</h2>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
            >
              {showForm ? 'Cancel' : '+ New Competition'}
            </button>
          )}
        </div>

        {error && <div className="text-danger-500 mt-2">{error}</div>}

        {showForm && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 mb-6">
            <h3 className="mt-0">Create New Competition</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 font-medium">Competition Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Spring Championship 2025"
                  required
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-medium">Competition Type *</label>
                <div className="flex gap-2 flex-wrap">
                  {(['NDCA', 'USA_DANCE', 'WDC', 'WDSF', 'UNAFFILIATED', 'STUDIO'] as CompetitionType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type, studioId: type === 'STUDIO' ? formData.studioId : '' })}
                      className="px-4 py-2 rounded cursor-pointer transition-all duration-200"
                      style={{
                        border: formData.type === type ? `2px solid ${getTypeColor(type)}` : '1px solid #cbd5e0',
                        background: formData.type === type ? getTypeColor(type) : 'white',
                        color: formData.type === type ? 'white' : '#2d3748',
                        fontWeight: formData.type === type ? 'bold' : 'normal',
                      }}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block mb-2 font-medium">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block mb-2 font-medium">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, State"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {formData.type === 'STUDIO' && (
                <div className="mb-4">
                  <label className="block mb-2 font-medium">Studio *</label>
                  {studios.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-400 p-4 rounded">
                      <p className="m-0">
                        No studios available. <button type="button" onClick={() => navigate('/studios')} className="text-primary-500 underline bg-transparent border-none cursor-pointer">Create one first &rarr;</button>
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formData.studioId}
                      onChange={e => setFormData({ ...formData, studioId: e.target.value })}
                      required
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                    >
                      <option value="">Select Studio</option>
                      {studios.map(studio => (
                        <option key={studio.id} value={studio.id}>
                          {studio.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="block mb-2 font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the competition..."
                  rows={3}
                  className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block mb-2 font-medium">Website URL</label>
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                    placeholder="https://mycompetition.com"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block mb-2 font-medium">Organizer Email</label>
                  <input
                    type="email"
                    value={formData.organizerEmail}
                    onChange={e => setFormData({ ...formData, organizerEmail: e.target.value })}
                    placeholder="organizer@example.com"
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              {organizations.length > 0 && (
                <div className="mb-4">
                  <label className="block mb-2 font-medium">Organization (Optional)</label>
                  <select
                    value={formData.organizationId}
                    onChange={e => {
                      const orgId = e.target.value;
                      setFormData(prev => ({ ...prev, organizationId: orgId }));
                      if (orgId) {
                        const org = organizations.find(o => o.id === parseInt(orgId));
                        if (org?.settings) {
                          if (org.settings.defaultLevels) setLevels([...org.settings.defaultLevels]);
                          if (org.settings.defaultScoringType) {
                            setFormData(prev => ({ ...prev, organizationId: orgId, defaultScoringType: org.settings.defaultScoringType! }));
                          }
                        }
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                  >
                    <option value="">None</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.rulePresetKey.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <small className="text-gray-500 mt-1 block">
                    Selecting an organization will pre-fill levels and scoring defaults.
                  </small>
                </div>
              )}

              <div className="mb-4">
                <label className="block mb-2 font-medium">Default Scoring Type</label>
                <div className="flex gap-2">
                  {(['standard', 'proficiency'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormData({ ...formData, defaultScoringType: st })}
                      className="px-4 py-2 rounded cursor-pointer transition-all duration-200"
                      style={{
                        border: formData.defaultScoringType === st ? '2px solid #2563eb' : '1px solid #cbd5e0',
                        background: formData.defaultScoringType === st ? '#2563eb' : 'white',
                        color: formData.defaultScoringType === st ? 'white' : '#2d3748',
                        fontWeight: formData.defaultScoringType === st ? 'bold' : 'normal',
                      }}
                    >
                      {st === 'standard' ? 'Standard' : 'Proficiency'}
                    </button>
                  ))}
                </div>
                <small className="text-gray-500 mt-1 block">
                  {formData.defaultScoringType === 'proficiency'
                    ? 'New events will default to proficiency scoring (0-100, single round).'
                    : 'New events will default to standard scoring (recalls + ranking).'}
                </small>
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-medium">Competition Levels</label>
                <p className="text-gray-500 text-sm mb-2">
                  Choose a template to start from, then customize as needed.
                </p>
                <div className="flex gap-2 flex-wrap mb-4">
                  {Object.entries(LEVEL_TEMPLATES).map(([key, template]) => {
                    const isActive = JSON.stringify(levels) === JSON.stringify(template.levels);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLevels([...template.levels])}
                        className="px-4 py-2 rounded cursor-pointer transition-all duration-200"
                        style={{
                          border: isActive ? '2px solid #667eea' : '1px solid #cbd5e0',
                          background: isActive ? '#667eea' : 'white',
                          color: isActive ? 'white' : '#2d3748',
                          fontWeight: isActive ? 'bold' : 'normal',
                        }}
                      >
                        {template.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1 max-w-[400px]">
                  {levels.map((lvl, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                      <span className="font-semibold min-w-[1.5rem]">{idx + 1}.</span>
                      <span className="flex-1">{lvl}</span>
                      <button type="button" disabled={idx === 0}
                        onClick={() => {
                          const next = [...levels];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          setLevels(next);
                        }}
                        className={`px-1.5 py-0.5 ${idx === 0 ? 'cursor-default opacity-30' : 'cursor-pointer opacity-100'}`}
                      >&#9650;</button>
                      <button type="button" disabled={idx === levels.length - 1}
                        onClick={() => {
                          const next = [...levels];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          setLevels(next);
                        }}
                        className={`px-1.5 py-0.5 ${idx === levels.length - 1 ? 'cursor-default opacity-30' : 'cursor-pointer opacity-100'}`}
                      >&#9660;</button>
                      <button type="button"
                        onClick={() => setLevels(levels.filter((_, i) => i !== idx))}
                        className="px-1.5 py-0.5 text-danger-500 cursor-pointer"
                      >&#10005;</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2 max-w-[400px]">
                  <input
                    type="text"
                    value={newLevelName}
                    onChange={e => setNewLevelName(e.target.value)}
                    placeholder="Add custom level..."
                    className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:border-primary-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
                          setLevels([...levels, newLevelName.trim()]);
                          setNewLevelName('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
                        setLevels([...levels, newLevelName.trim()]);
                        setNewLevelName('');
                      }
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-gray-600"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Creating...' : 'Create Competition'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {competitions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-4">No competitions created yet</p>
            <p>Create your first competition to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {competitions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(competition => (
                <div
                  key={competition.id}
                  className="border border-gray-200 rounded-lg p-6 bg-white transition-shadow duration-200 cursor-pointer hover:shadow-md"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="m-0">{competition.name}</h3>
                        <CompetitionTypeBadge type={competition.type} />
                      </div>
                      <div className="text-gray-500 text-sm">
                        <p className="my-1">📅 {formatDate(competition.date)}</p>
                        {competition.location && (
                          <p className="my-1">📍 {competition.location}</p>
                        )}
                        {competition.type === 'STUDIO' && competition.studioId && (
                          <p className="my-1">🏢 Studio: {studios.find(s => s.id === competition.studioId)?.name || competition.studioId}</p>
                        )}
                        {competition.organizationId && (
                          <p className="my-1">🏛 Org: {organizations.find(o => o.id === competition.organizationId)?.name || competition.organizationId}</p>
                        )}
                        {competition.description && (
                          <p className="mt-2 mb-0 text-gray-600">
                            {competition.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/competitions/${competition.id}`)}
                        className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
                      >
                        View Details
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteTarget({ id: competition.id, name: competition.name })}
                          className="px-4 py-2 bg-red-50 text-red-700 rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-red-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title="Delete Competition"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will delete all associated people, couples, judges, and events.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default CompetitionsPage;
