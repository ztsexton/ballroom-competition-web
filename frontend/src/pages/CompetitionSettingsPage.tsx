import { useState, useEffect, useRef, useCallback } from 'react';
import { competitionsApi } from '../api/client';
import { useCompetition } from '../context/CompetitionContext';
import { CompetitionType } from '../types';
import { DEFAULT_LEVELS, LEVEL_TEMPLATES } from '../constants/levels';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'ZAR', label: 'ZAR - South African Rand (R)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (CA$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

const COMP_TYPES: { value: CompetitionType; label: string; color: string }[] = [
  { value: 'NDCA', label: 'NDCA', color: '#dc2626' },
  { value: 'USA_DANCE', label: 'USA Dance', color: '#2563eb' },
  { value: 'UNAFFILIATED', label: 'Unaffiliated', color: '#059669' },
  { value: 'STUDIO', label: 'Studio', color: '#7c3aed' },
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
          <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Competition Type</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {COMP_TYPES.map(ct => {
              const active = comp.type === ct.value;
              return (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => saveField('type', ct.value, 'general')}
                  style={{
                    padding: '0.5rem 1rem',
                    border: active ? `2px solid ${ct.color}` : '1px solid #cbd5e0',
                    borderRadius: '4px',
                    background: active ? ct.color : 'white',
                    color: active ? 'white' : '#2d3748',
                    cursor: 'pointer',
                    fontWeight: active ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                  }}
                >
                  {ct.label}
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
                  onClick={() => saveLevels([...template.levels])}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Toggle
            value={comp.publiclyVisible !== false}
            onChange={v => saveField('publiclyVisible', v, 'visibility')}
            label={`Public Visibility ${comp.publiclyVisible !== false ? 'On' : 'Off'}`}
          />
          <Toggle
            value={!!comp.registrationOpen}
            onChange={v => saveField('registrationOpen', v, 'visibility')}
            label={`Participant Registration ${comp.registrationOpen ? 'Open' : 'Closed'}`}
          />
          <Toggle
            value={comp.resultsPublic !== false}
            onChange={v => saveField('resultsPublic', v, 'visibility')}
            label={`Public Results ${comp.resultsPublic !== false ? 'On' : 'Off'}`}
          />
        </div>
      </Section>
    </div>
  );
};

export default CompetitionSettingsPage;
