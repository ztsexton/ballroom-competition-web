import { useState, useEffect, useRef, useCallback } from 'react';
import { competitionsApi, organizationsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { CompetitionType, AgeCategory, Organization, RulePresetKey } from '../../types';
import { DEFAULT_LEVELS, LEVEL_TEMPLATES } from '../../constants/levels';

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
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    background: value ? '#f0fff4' : '#f7fafc',
    border: `1px solid ${value ? '#c6f6d5' : '#e2e8f0'}`,
    borderRadius: '6px',
  }}>
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px', border: 'none',
        background: value ? '#48bb78' : '#cbd5e0', cursor: 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: value ? '22px' : '2px',
        width: '20px', height: '20px', borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#4a5568' }}>{label}</span>
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
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(!open)}
      >
        <h3 style={{ margin: 0 }}>
          <span style={{ marginRight: '0.5rem', color: '#a0aec0' }}>{open ? '▾' : '▸'}</span>
          {title}
        </h3>
        {saved && (
          <span style={{ fontSize: '0.8125rem', color: '#48bb78', fontWeight: 600, transition: 'opacity 0.3s' }}>
            Saved
          </span>
        )}
      </div>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
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

  // Initialize from competition
  useEffect(() => {
    if (!activeCompetition) return;
    setName(activeCompetition.name || '');
    setDate(activeCompetition.date || '');
    setLocation(activeCompetition.location || '');
    setDescription(activeCompetition.description || '');
    setWebsiteUrl(activeCompetition.websiteUrl || '');
    setOrganizerEmail(activeCompetition.organizerEmail || '');
    setLevels(activeCompetition.levels || [...DEFAULT_LEVELS]);

    // Load organizations list
    organizationsApi.getAll()
      .then(res => setOrganizations(res.data))
      .catch(() => setOrganizations([]));

    // Load age categories from competition
    setAgeCategories(activeCompetition.ageCategories || []);

    // Load org name for display
    if (activeCompetition.organizationId) {
      organizationsApi.getById(activeCompetition.organizationId)
        .then(res => setOrgName(res.data.name))
        .catch(() => setOrgName(''));
    } else {
      setOrgName('');
    }
  }, [activeCompetition?.id]);

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

  if (!activeCompetition) return <div className="loading">Loading...</div>;

  const comp = activeCompetition;

  return (
    <div className="container">
      {/* ─── General ─── */}
      <Section title="General" savedKey="general" savedMap={savedMap}>
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Competition Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => saveOnBlur('name', name, 'general')}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Organization</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                  style={{
                    padding: '0.5rem 1rem',
                    border: active ? `2px solid ${preset.color}` : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: active ? preset.color : 'white',
                    color: active ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: active ? 'bold' : 'normal',
                    transition: 'all 0.2s',
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
                    style={{
                      padding: '0.5rem 1rem',
                      border: active ? `2px solid ${color}` : '1px solid #cbd5e0',
                      borderRadius: '4px',
                      background: active ? color : 'white',
                      color: active ? 'white' : '#2d3748',
                      cursor: 'pointer',
                      fontWeight: active ? 'bold' : 'normal',
                      transition: 'all 0.2s',
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
                  style={{
                    padding: '0.5rem 1rem',
                    border: active ? `2px solid ${opt.color}` : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: active ? opt.color : 'white',
                    color: active ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: active ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => {
                setDate(e.target.value);
                saveField('date', e.target.value, 'general');
              }}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onBlur={() => saveOnBlur('location', location, 'general')}
              placeholder="City, State"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => saveOnBlur('description', description, 'general')}
            placeholder="Additional details about the competition..."
            rows={3}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
        </div>
      </Section>

      {/* ─── Contact & Links ─── */}
      <Section title="Contact & Links" savedKey="contact" savedMap={savedMap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Website URL</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              onBlur={() => saveOnBlur('websiteUrl', websiteUrl, 'contact')}
              placeholder="https://mycompetition.com"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Organizer Email</label>
            <input
              type="email"
              value={organizerEmail}
              onChange={e => setOrganizerEmail(e.target.value)}
              onBlur={() => saveOnBlur('organizerEmail', organizerEmail, 'contact')}
              placeholder="organizer@example.com"
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            />
          </div>
        </div>
      </Section>

      {/* ─── Rules & Scoring ─── */}
      <Section title="Rules & Scoring" savedKey="rules" savedMap={savedMap}>
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Default Scoring Type</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['standard', 'proficiency'] as const).map(st => {
              const active = (comp.defaultScoringType || 'standard') === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => saveField('defaultScoringType', st, 'rules')}
                  style={{
                    padding: '0.5rem 1rem',
                    border: active ? '2px solid #2563eb' : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: active ? '#2563eb' : 'white',
                    color: active ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: active ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                >
                  {st === 'standard' ? 'Standard' : 'Proficiency'}
                </button>
              );
            })}
          </div>
          <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
            {(comp.defaultScoringType || 'standard') === 'proficiency'
              ? 'New events will default to proficiency scoring (0-100, single round).'
              : 'New events will default to standard scoring (recalls + ranking).'}
          </small>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Max Couples Per Heat</label>
          <input
            type="number"
            min="1"
            value={comp.maxCouplesPerHeat || ''}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              saveField('maxCouplesPerHeat', val, 'rules');
            }}
            placeholder="No limit"
            style={{ width: '120px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Level Mode</label>
          <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Choose how Open/Syllabus levels are configured for events.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
                  style={{
                    padding: '0.5rem 1rem',
                    border: isActive ? '2px solid #667eea' : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: isActive ? '#667eea' : 'white',
                    color: isActive ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: isActive ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <small style={{ color: '#718096', display: 'block', marginBottom: '1rem' }}>
            {(comp.levelMode || 'combined') === 'combined'
              ? 'Events show a separate "Open/Syllabus" toggle. Any level can be marked as Open.'
              : 'Events select from the level list directly. Include "Open" variants in your levels (e.g., "Open Silver").'}
          </small>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Competition Levels</label>
          <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            Choose a template to start from, then customize as needed.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
                  style={{
                    padding: '0.5rem 1rem',
                    border: isActive ? '2px solid #667eea' : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: isActive ? '#667eea' : 'white',
                    color: isActive ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: isActive ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                >
                  {template.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '400px' }}>
            {levels.map((lvl, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem', background: '#f7fafc',
                border: '1px solid #e2e8f0', borderRadius: '4px',
              }}>
                <span style={{ fontWeight: 600, minWidth: '1.5rem' }}>{idx + 1}.</span>
                <span style={{ flex: 1 }}>{lvl}</span>
                <button type="button" disabled={idx === 0}
                  onClick={() => {
                    const next = [...levels];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    saveLevels(next);
                  }}
                  style={{ padding: '0.125rem 0.375rem', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                >▲</button>
                <button type="button" disabled={idx === levels.length - 1}
                  onClick={() => {
                    const next = [...levels];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    saveLevels(next);
                  }}
                  style={{ padding: '0.125rem 0.375rem', cursor: idx === levels.length - 1 ? 'default' : 'pointer', opacity: idx === levels.length - 1 ? 0.3 : 1, background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                >▼</button>
                <button type="button"
                  onClick={() => saveLevels(levels.filter((_, i) => i !== idx))}
                  style={{ padding: '0.125rem 0.375rem', color: '#e53e3e', cursor: 'pointer', background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                >✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', maxWidth: '400px' }}>
            <input
              type="text"
              value={newLevelName}
              onChange={e => setNewLevelName(e.target.value)}
              placeholder="Add custom level..."
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
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
              className="btn btn-secondary"
              style={{ fontSize: '0.875rem' }}
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      {/* ─── Entry Validation ─── */}
      <Section title="Entry Validation" defaultOpen={false} savedKey="entry" savedMap={savedMap}>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
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
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Levels Above Allowed</label>
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
              style={{ width: '80px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            />
            <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
              How many levels above their declared level a participant can enter.
              For example, if set to 2, a Bronze 3 dancer can enter Bronze 3, Bronze 4, and Silver 1.
            </small>

            {levels.length > 0 && (
              <div style={{
                marginTop: '1rem',
                background: '#f0f4f8',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem',
              }}>
                <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096' }}>
                  Example
                </strong>
                <p style={{ fontSize: '0.8125rem', color: '#4a5568', marginTop: '0.375rem', marginBottom: '0.25rem' }}>
                  A participant declaring <strong>{levels[0]}</strong> can enter:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {levels.slice(0, 1 + (comp.entryValidation?.levelsAboveAllowed ?? 1)).map((lvl, i) => (
                    <span key={i} style={{
                      background: 'white',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                    }}>
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
            <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Preset from <strong>{orgName}</strong>. You can customize below for this competition.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {comp.organizationId && (() => {
              const org = organizations.find(o => o.id === comp.organizationId);
              const orgCats = org?.settings.ageCategories || [];
              return orgCats.length > 0 ? (
                <button
                  type="button"
                  onClick={() => saveAgeCategories(orgCats.map(c => ({ ...c })))}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                >
                  Reset to {orgName} Defaults
                </button>
              ) : null;
            })()}
            <button
              type="button"
              onClick={() => saveAgeCategories([...ageCategories, { name: '' }])}
              className="btn btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
            >
              + Add Category
            </button>
          </div>

          {/* Show org defaults for reference */}
          {comp.organizationId && (() => {
            const org = organizations.find(o => o.id === comp.organizationId);
            const orgCats = org?.settings.ageCategories || [];
            return orgCats.length > 0 ? (
              <div style={{
                background: '#f0f4f8',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                fontSize: '0.8125rem',
                color: '#4a5568',
              }}>
                <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096' }}>
                  {orgName} Defaults
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                  {orgCats.map((cat, i) => (
                    <span key={i} style={{
                      background: 'white',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                    }}>
                      {cat.name}
                      {(cat.minAge != null || cat.maxAge != null) && (
                        <span style={{ color: '#a0aec0', marginLeft: '0.25rem' }}>
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
            <p style={{ color: '#a0aec0', fontSize: '0.875rem' }}>
              No age categories configured.
              {comp.organizationId ? ' Click "Reset to Defaults" to load from the organization preset.' : ' Add categories manually or select an organization above.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '500px' }}>
              {ageCategories.map((cat, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
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
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
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
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
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
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                  />
                  <button
                    type="button"
                    onClick={() => saveAgeCategories(ageCategories.filter((_, i) => i !== idx))}
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
        </div>
      </Section>

      {/* ─── Floor Size ─── */}
      <Section title="Floor Size" defaultOpen={false} savedKey="floor" savedMap={savedMap}>
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Default Max Couples on Floor</label>
          <input
            type="number"
            min="1"
            value={comp.maxCouplesOnFloor || ''}
            onChange={e => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              saveField('maxCouplesOnFloor', val, 'floor');
            }}
            placeholder="No limit"
            style={{ width: '120px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
          <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
            When a round has more couples than this limit, it will be split into multiple floor heats.
            Each floor heat is scored independently. Leave empty for no automatic splitting.
          </small>
        </div>

        {levels.length > 0 && (
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Per-Level Overrides</label>
            <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Set a different floor limit for specific levels. Empty uses the default above.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxWidth: '400px' }}>
              {levels.map(lvl => (
                <div key={lvl} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.375rem 0.5rem',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                }}>
                  <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{lvl}</span>
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
                    style={{ width: '80px', padding: '0.375rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.875rem', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ─── Recall & Advancement ─── */}
      <Section title="Recall & Advancement" defaultOpen={false} savedKey="recall" savedMap={savedMap}>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          Controls how couples advance between rounds. By default, ties at the cut line are included
          and finals can expand up to 8 couples.
        </p>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Target Final Size</label>
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
            style={{ width: '80px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
          <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
            Number of couples to advance to the final round (default: 6).
          </small>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Final Max Size (Hard Limit)</label>
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
            style={{ width: '80px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
          />
          <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
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
        <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block', marginBottom: '0.5rem' }}>
          When enabled, all couples tied at the advancement cut line are included (may result in more
          couples than the target). When disabled, exactly the target number advance with no tie expansion.
        </small>
      </Section>

      {/* ─── Billing ─── */}
      <Section title="Billing" savedKey="billing" savedMap={savedMap}>
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Currency</label>
          <select
            value={comp.currency || 'USD'}
            onChange={e => saveField('currency', e.target.value, 'billing')}
            style={{
              padding: '0.375rem 0.75rem',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            {CURRENCY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <small style={{ color: '#718096', marginTop: '0.25rem', display: 'block' }}>
            This determines the currency used for entry fees and invoices.
          </small>
        </div>
      </Section>

      {/* ─── Visibility & Access ─── */}
      <Section title="Visibility & Access" savedKey="visibility" savedMap={savedMap}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Public Visibility */}
          <div>
            <Toggle
              value={comp.publiclyVisible !== false}
              onChange={v => saveField('publiclyVisible', v, 'visibility')}
              label={`Public Visibility ${comp.publiclyVisible !== false ? 'On' : 'Off'}`}
            />
            {!comp.publiclyVisible && (
              <div style={{ marginLeft: '3.25rem', marginTop: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#718096', display: 'block', marginBottom: '0.25rem' }}>
                  Schedule visibility for:
                </label>
                <input
                  type="datetime-local"
                  value={comp.publiclyVisibleAt || ''}
                  onChange={e => saveField('publiclyVisibleAt', e.target.value || null, 'visibility')}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                />
                {comp.publiclyVisibleAt && (
                  <button
                    type="button"
                    onClick={() => saveField('publiclyVisibleAt', null, 'visibility')}
                    style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
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
              <div style={{ marginLeft: '3.25rem', marginTop: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#718096', display: 'block', marginBottom: '0.25rem' }}>
                  Schedule registration to open:
                </label>
                <input
                  type="datetime-local"
                  value={comp.registrationOpenAt || ''}
                  onChange={e => saveField('registrationOpenAt', e.target.value || null, 'visibility')}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                />
                {comp.registrationOpenAt && (
                  <button
                    type="button"
                    onClick={() => saveField('registrationOpenAt', null, 'visibility')}
                    style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
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
              <div style={{ marginLeft: '3.25rem', marginTop: '0.375rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.375rem' }}>
                  Heat lists are only visible to admins until published.
                </p>
                <label style={{ fontSize: '0.75rem', color: '#718096', display: 'block', marginBottom: '0.25rem' }}>
                  Schedule publish for:
                </label>
                <input
                  type="datetime-local"
                  value={comp.heatListsPublishedAt || ''}
                  onChange={e => saveField('heatListsPublishedAt', e.target.value || null, 'visibility')}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
                />
                {comp.heatListsPublishedAt && (
                  <button
                    type="button"
                    onClick={() => saveField('heatListsPublishedAt', null, 'visibility')}
                    style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
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
