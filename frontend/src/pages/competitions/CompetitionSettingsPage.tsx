import { useState, useEffect, useRef, useCallback } from 'react';
import { competitionsApi, organizationsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { CompetitionType, CompetitionAdmin, AgeCategory, Organization, RulePresetKey } from '../../types';
import { DEFAULT_LEVELS, LEVEL_TEMPLATES } from '../../constants/levels';
import { Skeleton } from '../../components/Skeleton';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'ZAR', label: 'ZAR - South African Rand (R)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

const PRESET_TO_TYPE: Record<string, CompetitionType> = {
  ndca: 'NDCA',
  usadance: 'USA_DANCE',
  wdc: 'WDC',
  wdsf: 'WDSF',
  custom: 'UNAFFILIATED',
};

const PRESET_COLORS: Record<string, string> = {
  ndca: '#dc2626',
  usadance: '#2563eb',
  wdc: '#059669',
  wdsf: '#d97706',
  custom: '#6b7280',
};

const KNOWN_PRESETS: { key: RulePresetKey; label: string; color: string }[] = [
  { key: 'ndca', label: 'NDCA', color: '#dc2626' },
  { key: 'usadance', label: 'USA Dance', color: '#2563eb' },
  { key: 'wdc', label: 'WDC', color: '#059669' },
  { key: 'wdsf', label: 'WDSF', color: '#d97706' },
];

// ─── Toggle Switch ───

const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${value ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full border-none cursor-pointer relative transition-colors shrink-0 ${value ? 'bg-success-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
    <span className="text-sm font-medium text-gray-600">{label}</span>
  </div>
);

// ─── Section wrapper ───

const Section = ({
  title,
  defaultOpen = true,
  savedKey,
  savedMap,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  savedKey: string;
  savedMap: Record<string, boolean>;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const saved = savedMap[savedKey];

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-3">
      <div
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <h3 className="m-0">
          <span className="mr-2 text-gray-400">{open ? '▾' : '▸'}</span>
          {title}
        </h3>
        {saved && (
          <span className="text-[0.8125rem] text-success-500 font-semibold transition-opacity">
            Saved
          </span>
        )}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
};

// ─── Competition Admins Section ───

type EnrichedAdmin = CompetitionAdmin & { email?: string; displayName?: string; firstName?: string; lastName?: string };

const CompetitionAdminsSection = ({
  competitionId,
  savedMap,
  flashSaved,
}: {
  competitionId: number;
  savedMap: Record<string, boolean>;
  flashSaved: (key: string) => void;
}) => {
  const { isAdmin } = useAuth();
  const [admins, setAdmins] = useState<EnrichedAdmin[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!competitionId) return;
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add admin');
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
    <Section title="Competition Admins" defaultOpen={false} savedKey="admins" savedMap={savedMap}>
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

// ─── Main Page ───

const CompetitionSettingsPage = () => {
  const { activeCompetition, setActiveCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;

  // Saved feedback per section
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = useCallback((key: string) => {
    setSavedMap(prev => ({ ...prev, [key]: true }));
    if (timerRefs.current[key]) clearTimeout(timerRefs.current[key]);
    timerRefs.current[key] = setTimeout(() => {
      setSavedMap(prev => ({ ...prev, [key]: false }));
    }, 2000);
  }, []);

  // Local state for text inputs (save on blur)
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [levels, setLevels] = useState<string[]>([]);
  const [newLevelName, setNewLevelName] = useState('');
  const [ageCategories, setAgeCategories] = useState<AgeCategory[]>([]);
  const [orgName, setOrgName] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Initialize from competition - also sync when data changes (e.g., after save)
  useEffect(() => {
    if (!activeCompetition) return;
    setName(activeCompetition.name || '');
    setDate(activeCompetition.date || '');
    setLocation(activeCompetition.location || '');
    setDescription(activeCompetition.description || '');
    setWebsiteUrl(activeCompetition.websiteUrl || '');
    setOrganizerEmail(activeCompetition.organizerEmail || '');
    setLevels(activeCompetition.levels || [...DEFAULT_LEVELS]);
    setAgeCategories(activeCompetition.ageCategories || []);
  }, [
    activeCompetition?.id,
    activeCompetition?.name,
    activeCompetition?.date,
    activeCompetition?.location,
    activeCompetition?.description,
    activeCompetition?.websiteUrl,
    activeCompetition?.organizerEmail,
    activeCompetition?.levels,
    activeCompetition?.ageCategories,
  ]);

  // Load organizations list (only on competition change)
  useEffect(() => {
    if (!activeCompetition) return;

    organizationsApi.getAll()
      .then(res => setOrganizations(res.data))
      .catch(() => setOrganizations([]));

    // Load org name for display
    if (activeCompetition.organizationId) {
      organizationsApi.getById(activeCompetition.organizationId)
        .then(res => setOrgName(res.data.name))
        .catch(() => setOrgName(''));
    } else {
      setOrgName('');
    }
  }, [activeCompetition?.id, activeCompetition?.organizationId]);

  const saveField = async (field: string, value: unknown, section: string) => {
    try {
      const res = await competitionsApi.update(competitionId, { [field]: value });
      setActiveCompetition(res.data);
      flashSaved(section);
    } catch {
      alert(`Failed to save ${field}`);
    }
  };

  const saveOnBlur = (field: string, value: string, section: string) => {
    const current = activeCompetition?.[field as keyof typeof activeCompetition];
    if (value === (current || '')) return; // no change
    saveField(field, value || undefined, section);
  };

  const saveLevels = async (newLevels: string[]) => {
    setLevels(newLevels);
    try {
      const res = await competitionsApi.update(competitionId, { levels: newLevels });
      setActiveCompetition(res.data);
      flashSaved('rules');
    } catch {
      alert('Failed to save levels');
    }
  };

  const isOrgActive = (targetOrg: Organization | null, targetType: CompetitionType) => {
    if (targetOrg) return activeCompetition?.organizationId === targetOrg.id;
    return !activeCompetition?.organizationId && activeCompetition?.type === targetType;
  };

  const confirmOrgSwitch = (label: string, hasOrg: boolean) => {
    return window.confirm(
      `Switch to ${label}? This will update the competition type and age categories.` +
      (hasOrg ? ' Default settings will be applied where you haven\'t made custom changes.' : '')
    );
  };

  const handleOrgSwitch = async (
    targetOrg: Organization | null,
    targetType: CompetitionType,
  ) => {

    const updates: Record<string, unknown> = {
      type: targetType,
      organizationId: targetOrg?.id || null,
    };

    // Apply new org defaults only for settings that still match the previous org's defaults
    if (targetOrg) {
      const prevOrg = activeCompetition?.organizationId
        ? organizations.find(o => o.id === activeCompetition.organizationId)
        : null;
      const prevDefaults = prevOrg?.settings || {};
      const newDefaults = targetOrg.settings || {};

      // Levels: apply new default if current matches previous default (or unset)
      const currentLevels = activeCompetition?.levels || [];
      const prevDefaultLevels = prevDefaults.defaultLevels || [];
      if (currentLevels.length === 0 ||
          JSON.stringify(currentLevels) === JSON.stringify(prevDefaultLevels)) {
        if (newDefaults.defaultLevels?.length) {
          updates.levels = newDefaults.defaultLevels;
        }
      }

      // Scoring type: apply if unchanged from previous default
      const currentScoring = activeCompetition?.defaultScoringType || 'standard';
      const prevDefaultScoring = prevDefaults.defaultScoringType || 'standard';
      if (currentScoring === prevDefaultScoring) {
        if (newDefaults.defaultScoringType) {
          updates.defaultScoringType = newDefaults.defaultScoringType;
        }
      }

      // Max couples per heat: apply if unchanged from previous default
      const currentMax = activeCompetition?.maxCouplesPerHeat;
      const prevDefaultMax = prevDefaults.defaultMaxCouplesPerHeat;
      if (currentMax === prevDefaultMax || !currentMax) {
        if (newDefaults.defaultMaxCouplesPerHeat) {
          updates.maxCouplesPerHeat = newDefaults.defaultMaxCouplesPerHeat;
        }
      }

      // Age categories: apply new org's defaults if unchanged from previous org's
      const currentAgeCats = activeCompetition?.ageCategories || [];
      const prevAgeCats = prevDefaults.ageCategories || [];
      if (currentAgeCats.length === 0 ||
          JSON.stringify(currentAgeCats) === JSON.stringify(prevAgeCats)) {
        updates.ageCategories = newDefaults.ageCategories || [];
      }
    } else {
      // Switching to Unaffiliated/Studio — clear age categories if not customized
      updates.ageCategories = [];
    }

    const res = await competitionsApi.update(competitionId, updates as any);
    setActiveCompetition(res.data);
    setOrgName(targetOrg?.name || '');
    setAgeCategories(res.data.ageCategories || []);
    if (res.data.levels) setLevels(res.data.levels);
    flashSaved('general');
  };

  const saveAgeCategories = async (cats: AgeCategory[]) => {
    setAgeCategories(cats);
    try {
      const res = await competitionsApi.update(competitionId, { ageCategories: cats } as any);
      setActiveCompetition(res.data);
      flashSaved('age');
    } catch {
      alert('Failed to save age categories');
    }
  };

  if (!activeCompetition) return (
    <div className="max-w-7xl mx-auto p-8">
      <Skeleton variant="card" />
      <Skeleton variant="card" />
    </div>
  );

  const comp = activeCompetition;

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* ─── General ─── */}
      <Section title="General" savedKey="general" savedMap={savedMap}>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Competition Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => saveOnBlur('name', name, 'general')}
            className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Organization</label>
          <div className="flex gap-2 flex-wrap">
            {KNOWN_PRESETS.map(preset => {
              const existingOrg = organizations.find(o => o.rulePresetKey === preset.key);
              const active = existingOrg
                ? comp.organizationId === existingOrg.id
                : (!comp.organizationId && comp.type === PRESET_TO_TYPE[preset.key]);
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={async () => {
                    let org = existingOrg || null;
                    const targetType = PRESET_TO_TYPE[preset.key] || 'UNAFFILIATED';
                    if (isOrgActive(org, targetType)) return;
                    if (!confirmOrgSwitch(preset.label, true)) return;
                    if (!org) {
                      const newOrg = await organizationsApi.create({
                        name: preset.label,
                        rulePresetKey: preset.key,
                        settings: {},
                      });
                      org = newOrg.data;
                      setOrganizations(prev => [...prev, org!]);
                    }
                    await handleOrgSwitch(org, targetType);
                  }}
                  className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
                  style={{
                    borderColor: active ? preset.color : undefined,
                    background: active ? preset.color : undefined,
                    color: active ? 'white' : undefined,
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
            {organizations
              .filter(org => !KNOWN_PRESETS.some(p => p.key === org.rulePresetKey))
              .map(org => {
                const active = comp.organizationId === org.id;
                const color = PRESET_COLORS[org.rulePresetKey] || '#6b7280';
                return (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      const targetType = PRESET_TO_TYPE[org.rulePresetKey] || 'UNAFFILIATED';
                      if (isOrgActive(org, targetType)) return;
                      if (!confirmOrgSwitch(org.name, true)) return;
                      handleOrgSwitch(org, targetType);
                    }}
                    className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
                    style={{
                      borderColor: active ? color : undefined,
                      background: active ? color : undefined,
                      color: active ? 'white' : undefined,
                    }}
                  >
                    {org.name}
                  </button>
                );
              })}
            {[
              { type: 'UNAFFILIATED' as CompetitionType, label: 'Unaffiliated', color: '#6b7280' },
              { type: 'STUDIO' as CompetitionType, label: 'Studio', color: '#7c3aed' },
            ].map(opt => {
              const active = !comp.organizationId && comp.type === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    if (isOrgActive(null, opt.type)) return;
                    if (!confirmOrgSwitch(opt.label, false)) return;
                    handleOrgSwitch(null, opt.type);
                  }}
                  className={`px-4 py-2 rounded cursor-pointer transition-all ${active ? 'border-2 font-bold' : 'border border-gray-300 bg-white text-gray-700 font-normal'}`}
                  style={{
                    borderColor: active ? opt.color : undefined,
                    background: active ? opt.color : undefined,
                    color: active ? 'white' : undefined,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => {
                setDate(e.target.value);
                saveField('date', e.target.value, 'general');
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onBlur={() => saveOnBlur('location', location, 'general')}
              placeholder="City, State"
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => saveOnBlur('description', description, 'general')}
            placeholder="Additional details about the competition..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </Section>

      {/* ─── Contact & Links ─── */}
      <Section title="Contact & Links" savedKey="contact" savedMap={savedMap}>
        <div className="grid grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Website URL</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              onBlur={() => saveOnBlur('websiteUrl', websiteUrl, 'contact')}
              placeholder="https://mycompetition.com"
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Organizer Email</label>
            <input
              type="email"
              value={organizerEmail}
              onChange={e => setOrganizerEmail(e.target.value)}
              onBlur={() => saveOnBlur('organizerEmail', organizerEmail, 'contact')}
              placeholder="organizer@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </Section>

      {/* ─── Rules & Scoring ─── */}
      <Section title="Rules & Scoring" savedKey="rules" savedMap={savedMap}>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Default Scoring Type</label>
          <div className="flex gap-2">
            {(['standard', 'proficiency'] as const).map(st => {
              const active = (comp.defaultScoringType || 'standard') === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => saveField('defaultScoringType', st, 'rules')}
                  className={`px-4 py-2 rounded cursor-pointer transition-all ${
                    active
                      ? 'border-2 border-blue-600 bg-blue-600 text-white font-bold'
                      : 'border border-gray-300 bg-white text-gray-700 font-normal'
                  }`}
                >
                  {st === 'standard' ? 'Standard' : 'Proficiency'}
                </button>
              );
            })}
          </div>
          <small className="text-gray-500 text-sm mt-1 block">
            {(comp.defaultScoringType || 'standard') === 'proficiency'
              ? 'New events will default to proficiency scoring (0-100, single round).'
              : 'New events will default to standard scoring (recalls + ranking).'}
          </small>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Max Couples Per Heat</label>
          <input
            type="number"
            min="1"
            value={comp.maxCouplesPerHeat || ''}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              saveField('maxCouplesPerHeat', val, 'rules');
            }}
            placeholder="No limit"
            className="w-[120px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Level Mode</label>
          <p className="text-gray-500 text-sm mb-2">
            Choose how Open/Syllabus levels are configured for events.
          </p>
          <div className="flex gap-2 mb-4">
            {[
              { value: 'combined', label: 'Combined', description: 'Separate Open/Syllabus toggle (e.g., Silver + Open)' },
              { value: 'integrated', label: 'Integrated', description: 'Open levels in list (e.g., Silver 1, Open Silver)' },
            ].map(mode => {
              const isActive = (comp.levelMode || 'combined') === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => saveField('levelMode', mode.value, 'rules')}
                  className={`px-4 py-2 rounded cursor-pointer transition-all ${
                    isActive
                      ? 'border-2 border-primary-500 bg-primary-500 text-white font-bold'
                      : 'border border-gray-300 bg-white text-gray-700 font-normal'
                  }`}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <small className="text-gray-500 text-sm block mb-4">
            {(comp.levelMode || 'combined') === 'combined'
              ? 'Events show a separate "Open/Syllabus" toggle. Any level can be marked as Open.'
              : 'Events select from the level list directly. Include "Open" variants in your levels (e.g., "Open Silver").'}
          </small>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Competition Levels</label>
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
                  onClick={() => {
                    saveLevels([...template.levels]);
                    if (template.levelMode) {
                      saveField('levelMode', template.levelMode, 'rules');
                    }
                  }}
                  className={`px-4 py-2 rounded cursor-pointer transition-all ${
                    isActive
                      ? 'border-2 border-primary-500 bg-primary-500 text-white font-bold'
                      : 'border border-gray-300 bg-white text-gray-700 font-normal'
                  }`}
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
                    saveLevels(next);
                  }}
                  className={`px-1.5 py-0.5 bg-transparent border border-gray-200 rounded ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >▲</button>
                <button type="button" disabled={idx === levels.length - 1}
                  onClick={() => {
                    const next = [...levels];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    saveLevels(next);
                  }}
                  className={`px-1.5 py-0.5 bg-transparent border border-gray-200 rounded ${idx === levels.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                >▼</button>
                <button type="button"
                  onClick={() => saveLevels(levels.filter((_, i) => i !== idx))}
                  className="px-1.5 py-0.5 text-red-600 cursor-pointer bg-transparent border border-gray-200 rounded"
                >✕</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-2 max-w-[400px]">
            <input
              type="text"
              value={newLevelName}
              onChange={e => setNewLevelName(e.target.value)}
              placeholder="Add custom level..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
                    saveLevels([...levels, newLevelName.trim()]);
                    setNewLevelName('');
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (newLevelName.trim() && !levels.includes(newLevelName.trim())) {
                  saveLevels([...levels, newLevelName.trim()]);
                  setNewLevelName('');
                }
              }}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      {/* ─── Entry Validation ─── */}
      <Section title="Entry Validation" defaultOpen={false} savedKey="entry" savedMap={savedMap}>
        <p className="text-gray-500 text-sm mb-3">
          Restrict which levels participants can enter based on their declared skill level.
          Admins can always override these restrictions when entering participants manually.
        </p>

        <Toggle
          value={!!comp.entryValidation?.enabled}
          onChange={v => {
            const validation = { ...(comp.entryValidation || { enabled: false, levelsAboveAllowed: 1 }), enabled: v };
            saveField('entryValidation', validation, 'entry');
          }}
          label={`Entry Level Restrictions ${comp.entryValidation?.enabled ? 'Enabled' : 'Disabled'}`}
        />

        {comp.entryValidation?.enabled && (
          <div className="mb-4 mt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Levels Above Allowed</label>
            <input
              type="number"
              min="0"
              max="10"
              value={comp.entryValidation?.levelsAboveAllowed ?? 1}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : 0;
                const validation = { ...(comp.entryValidation || { enabled: true, levelsAboveAllowed: 1 }), levelsAboveAllowed: val };
                saveField('entryValidation', validation, 'entry');
              }}
              className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <small className="text-gray-500 text-sm mt-1 block">
              How many levels above their declared level a participant can enter.
              For example, if set to 2, a Bronze 3 dancer can enter Bronze 3, Bronze 4, and Silver 1.
            </small>

            {levels.length > 0 && (
              <div className="mt-4 bg-gray-100 border border-gray-200 rounded-md p-3">
                <strong className="text-xs uppercase tracking-wide text-gray-500">
                  Example
                </strong>
                <p className="text-[0.8125rem] text-gray-600 mt-1.5 mb-1">
                  A participant declaring <strong>{levels[0]}</strong> can enter:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {levels.slice(0, 1 + (comp.entryValidation?.levelsAboveAllowed ?? 1)).map((lvl, i) => (
                    <span key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                      {lvl}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─── Age Categories ─── */}
      <Section title="Age Categories" defaultOpen={false} savedKey="age" savedMap={savedMap}>
        <div>
          {comp.organizationId && orgName && (
            <p className="text-gray-500 text-sm mb-3">
              Preset from <strong>{orgName}</strong>. You can customize below for this competition.
            </p>
          )}

          <div className="flex gap-2 flex-wrap mb-3">
            {comp.organizationId && (() => {
              const org = organizations.find(o => o.id === comp.organizationId);
              const orgCats = org?.settings.ageCategories || [];
              return orgCats.length > 0 ? (
                <button
                  type="button"
                  onClick={() => saveAgeCategories(orgCats.map(c => ({ ...c })))}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
                >
                  Reset to {orgName} Defaults
                </button>
              ) : null;
            })()}
            <button
              type="button"
              onClick={() => saveAgeCategories([...ageCategories, { name: '' }])}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200"
            >
              + Add Category
            </button>
          </div>

          {/* Show org defaults for reference */}
          {comp.organizationId && (() => {
            const org = organizations.find(o => o.id === comp.organizationId);
            const orgCats = org?.settings.ageCategories || [];
            return orgCats.length > 0 ? (
              <div className="bg-gray-100 border border-gray-200 rounded-md p-3 mb-3 text-[0.8125rem] text-gray-600">
                <strong className="text-xs uppercase tracking-wide text-gray-500">
                  {orgName} Defaults
                </strong>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {orgCats.map((cat, i) => (
                    <span key={i} className="bg-white border border-gray-300 rounded px-2 py-1 text-xs">
                      {cat.name}
                      {(cat.minAge != null || cat.maxAge != null) && (
                        <span className="text-gray-400 ml-1">
                          ({cat.minAge != null && cat.maxAge != null
                            ? `${cat.minAge}-${cat.maxAge}`
                            : cat.maxAge != null
                              ? `≤${cat.maxAge}`
                              : `${cat.minAge}+`})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {ageCategories.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No age categories configured.
              {comp.organizationId ? ' Click "Reset to Defaults" to load from the organization preset.' : ' Add categories manually or select an organization above.'}
            </p>
          ) : (
            <div className="grid gap-2 max-w-[500px]">
              {ageCategories.map((cat, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={cat.name}
                    placeholder="Name"
                    onChange={e => {
                      const updated = [...ageCategories];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setAgeCategories(updated);
                    }}
                    onBlur={() => saveAgeCategories(ageCategories)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    value={cat.minAge ?? ''}
                    placeholder="Min age"
                    onChange={e => {
                      const updated = [...ageCategories];
                      updated[idx] = { ...updated[idx], minAge: e.target.value ? parseInt(e.target.value) : undefined };
                      setAgeCategories(updated);
                    }}
                    onBlur={() => saveAgeCategories(ageCategories)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <input
                    type="number"
                    value={cat.maxAge ?? ''}
                    placeholder="Max age"
                    onChange={e => {
                      const updated = [...ageCategories];
                      updated[idx] = { ...updated[idx], maxAge: e.target.value ? parseInt(e.target.value) : undefined };
                      setAgeCategories(updated);
                    }}
                    onBlur={() => saveAgeCategories(ageCategories)}
                    className="px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => saveAgeCategories(ageCategories.filter((_, i) => i !== idx))}
                    className="px-2 py-1 bg-transparent border border-gray-200 rounded text-red-600 cursor-pointer text-sm"
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ─── Floor Size ─── */}
      <Section title="Floor Size" defaultOpen={false} savedKey="floor" savedMap={savedMap}>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Default Max Couples on Floor</label>
          <input
            type="number"
            min="1"
            value={comp.maxCouplesOnFloor || ''}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              saveField('maxCouplesOnFloor', val, 'floor');
            }}
            placeholder="No limit"
            className="w-[120px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <small className="text-gray-500 text-sm mt-1 block">
            When a round has more couples than this limit, it will be split into multiple floor heats.
            Each floor heat is scored independently. Leave empty for no automatic splitting.
          </small>
        </div>

        {levels.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Per-Level Overrides</label>
            <p className="text-gray-500 text-sm mb-2">
              Set a different floor limit for specific levels. Empty uses the default above.
            </p>
            <div className="flex flex-col gap-1.5 max-w-[400px]">
              {levels.map(lvl => (
                <div key={lvl} className="flex items-center gap-3 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded">
                  <span className="flex-1 text-sm font-medium">{lvl}</span>
                  <input
                    type="number"
                    min="1"
                    value={comp.maxCouplesOnFloorByLevel?.[lvl] || ''}
                    onChange={e => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const updated = { ...(comp.maxCouplesOnFloorByLevel || {}) };
                      if (val) {
                        updated[lvl] = val;
                      } else {
                        delete updated[lvl];
                      }
                      saveField('maxCouplesOnFloorByLevel', Object.keys(updated).length > 0 ? updated : undefined, 'floor');
                    }}
                    placeholder={comp.maxCouplesOnFloor ? `${comp.maxCouplesOnFloor}` : '—'}
                    className="w-20 px-1.5 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ─── Recall & Advancement ─── */}
      <Section title="Recall & Advancement" defaultOpen={false} savedKey="recall" savedMap={savedMap}>
        <p className="text-gray-500 text-sm mb-3">
          Controls how couples advance between rounds. By default, ties at the cut line are included
          and finals can expand up to 8 couples.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Target Final Size</label>
          <input
            type="number"
            min="2"
            max="20"
            value={comp.recallRules?.finalSize ?? 6}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : 6;
              const rules = { ...(comp.recallRules || {}), finalSize: val };
              saveField('recallRules', rules, 'recall');
            }}
            className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <small className="text-gray-500 text-sm mt-1 block">
            Number of couples to advance to the final round (default: 6).
          </small>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Final Max Size (Hard Limit)</label>
          <input
            type="number"
            min="2"
            max="20"
            value={comp.recallRules?.finalMaxSize ?? 8}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : 8;
              const rules = { ...(comp.recallRules || {}), finalMaxSize: val };
              saveField('recallRules', rules, 'recall');
            }}
            className="w-20 px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <small className="text-gray-500 text-sm mt-1 block">
            Maximum couples allowed in the final, even with ties (default: 8).
            If a tie at the cut line would exceed this limit, only those strictly above the cut line advance.
          </small>
        </div>

        <Toggle
          value={comp.recallRules?.includeTies !== false}
          onChange={v => {
            const rules = { ...(comp.recallRules || {}), includeTies: v };
            saveField('recallRules', rules, 'recall');
          }}
          label={`Include Ties at Cut Line ${comp.recallRules?.includeTies !== false ? 'On' : 'Off'}`}
        />
        <small className="text-gray-500 text-sm mt-1 block mb-2">
          When enabled, all couples tied at the advancement cut line are included (may result in more
          couples than the target). When disabled, exactly the target number advance with no tie expansion.
        </small>
      </Section>

      {/* ─── Billing ─── */}
      <Section title="Billing" savedKey="billing" savedMap={savedMap}>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-1">Currency</label>
          <select
            value={comp.currency || 'USD'}
            onChange={e => saveField('currency', e.target.value, 'billing')}
            className="px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            {CURRENCY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <small className="text-gray-500 text-sm mt-1 block">
            This determines the currency used for entry fees and invoices.
          </small>
        </div>
      </Section>

      {/* ─── Competition Admins ─── */}
      <CompetitionAdminsSection competitionId={competitionId} savedMap={savedMap} flashSaved={flashSaved} />

      {/* ─── Visibility & Access ─── */}
      <Section title="Visibility & Access" savedKey="visibility" savedMap={savedMap}>
        <div className="flex flex-col gap-4">
          {/* Public Visibility */}
          <div>
            <Toggle
              value={comp.publiclyVisible !== false}
              onChange={v => saveField('publiclyVisible', v, 'visibility')}
              label={`Public Visibility ${comp.publiclyVisible !== false ? 'On' : 'Off'}`}
            />
            {!comp.publiclyVisible && (
              <div className="ml-[3.25rem] mt-1.5">
                <label className="text-xs text-gray-500 block mb-1">
                  Schedule visibility for:
                </label>
                <input
                  type="datetime-local"
                  value={comp.publiclyVisibleAt || ''}
                  onChange={e => saveField('publiclyVisibleAt', e.target.value || null, 'visibility')}
                  className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                {comp.publiclyVisibleAt && (
                  <button
                    type="button"
                    onClick={() => saveField('publiclyVisibleAt', null, 'visibility')}
                    className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Registration */}
          <div>
            <Toggle
              value={!!comp.registrationOpen}
              onChange={v => saveField('registrationOpen', v, 'visibility')}
              label={`Participant Registration ${comp.registrationOpen ? 'Open' : 'Closed'}`}
            />
            {!comp.registrationOpen && (
              <div className="ml-[3.25rem] mt-1.5">
                <label className="text-xs text-gray-500 block mb-1">
                  Schedule registration to open:
                </label>
                <input
                  type="datetime-local"
                  value={comp.registrationOpenAt || ''}
                  onChange={e => saveField('registrationOpenAt', e.target.value || null, 'visibility')}
                  className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                {comp.registrationOpenAt && (
                  <button
                    type="button"
                    onClick={() => saveField('registrationOpenAt', null, 'visibility')}
                    className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          <Toggle
            value={comp.resultsPublic !== false}
            onChange={v => saveField('resultsPublic', v, 'visibility')}
            label={`Public Results ${comp.resultsPublic !== false ? 'On' : 'Off'}`}
          />

          {/* Heat Lists */}
          <div>
            <Toggle
              value={!!comp.heatListsPublished}
              onChange={v => saveField('heatListsPublished', v, 'visibility')}
              label={`Heat Lists ${comp.heatListsPublished ? 'Published' : 'Draft'}`}
            />
            {!comp.heatListsPublished && (
              <div className="ml-[3.25rem] mt-1.5">
                <p className="text-xs text-gray-500 mb-1.5">
                  Heat lists are only visible to admins until published.
                </p>
                <label className="text-xs text-gray-500 block mb-1">
                  Schedule publish for:
                </label>
                <input
                  type="datetime-local"
                  value={comp.heatListsPublishedAt || ''}
                  onChange={e => saveField('heatListsPublishedAt', e.target.value || null, 'visibility')}
                  className="px-2 py-1 rounded border border-gray-200 text-[0.8125rem] focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                {comp.heatListsPublishedAt && (
                  <button
                    type="button"
                    onClick={() => saveField('heatListsPublishedAt', null, 'visibility')}
                    className="ml-2 text-xs text-red-600 bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
};

export default CompetitionSettingsPage;
