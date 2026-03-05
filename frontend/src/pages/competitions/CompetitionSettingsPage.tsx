import { useState, useEffect, useRef, useCallback } from 'react';
import { competitionsApi, organizationsApi, settingsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { CompetitionType, AgeCategory, Organization } from '../../types';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { DEFAULT_STYLE_ORDER, DEFAULT_DANCE_ORDER, getDancesForStyle } from '../../constants/dances';
import { Skeleton } from '../../components/Skeleton';
import {
  Section,
  CompetitionAdminsSection,
  GeneralSection,
  RulesAndScoringSection,
  EntryValidationSection,
  AgeCategoriesSection,
  FloorSizeSection,
  DuplicateEntriesSection,
  RecallAdvancementSection,
  VisibilityAccessSection,
  CURRENCY_OPTIONS,
} from './components/settings';
import JudgeScheduleView from '../dayof/Schedule/components/JudgeScheduleView';

// ─── Tabs ───

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'rules', label: 'Rules' },
  { key: 'events', label: 'Events' },
  { key: 'judges', label: 'Judges' },
  { key: 'billing', label: 'Billing' },
  { key: 'access', label: 'Access' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Main Page ───

const CompetitionSettingsPage = () => {
  const { activeCompetition, setActiveCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;
  const [activeTab, setActiveTab] = useState<TabKey>('general');

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
  const [siteDefaultBreakHours, setSiteDefaultBreakHours] = useState<number | undefined>();

  // Fetch site settings for default break hours
  useEffect(() => {
    settingsApi.get()
      .then(res => setSiteDefaultBreakHours(res.data.maxJudgeHoursWithoutBreak))
      .catch(() => {});
  }, []);

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
      .then(res => {
        setOrganizations(res.data);
        // Derive org name from the loaded list instead of a separate API call
        if (activeCompetition.organizationId) {
          const org = res.data.find((o: Organization) => o.id === activeCompetition.organizationId);
          setOrgName(org?.name || '');
        } else {
          setOrgName('');
        }
      })
      .catch(() => {
        setOrganizations([]);
        setOrgName('');
      });
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
      {/* ─── Tab Bar ─── */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-b-2 border-primary-500 text-primary-600 font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── General Tab ─── */}
      {activeTab === 'general' && (
        <>
          <GeneralSection
            comp={comp}
            savedMap={savedMap}
            name={name}
            setName={setName}
            date={date}
            setDate={setDate}
            location={location}
            setLocation={setLocation}
            description={description}
            setDescription={setDescription}
            organizations={organizations}
            setOrganizations={setOrganizations}
            saveField={saveField}
            saveOnBlur={saveOnBlur}
            handleOrgSwitch={handleOrgSwitch}
            isOrgActive={isOrgActive}
            confirmOrgSwitch={confirmOrgSwitch}
          />

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
        </>
      )}

      {/* ─── Rules Tab ─── */}
      {activeTab === 'rules' && (
        <>
          <RulesAndScoringSection
            comp={comp}
            savedMap={savedMap}
            levels={levels}
            newLevelName={newLevelName}
            setNewLevelName={setNewLevelName}
            saveField={saveField}
            saveLevels={saveLevels}
          />

          <EntryValidationSection
            comp={comp}
            savedMap={savedMap}
            levels={levels}
            saveField={saveField}
          />

          <RecallAdvancementSection
            comp={comp}
            savedMap={savedMap}
            saveField={saveField}
          />
        </>
      )}

      {/* ─── Events Tab ─── */}
      {activeTab === 'events' && (
        <>
          <DanceOrderSettingsSection
            comp={comp}
            savedMap={savedMap}
            saveField={saveField}
          />

          <FloorSizeSection
            comp={comp}
            savedMap={savedMap}
            levels={levels}
            saveField={saveField}
          />

          <DuplicateEntriesSection
            comp={comp}
            savedMap={savedMap}
            saveField={saveField}
          />
        </>
      )}

      {/* ─── Judges Tab ─── */}
      {activeTab === 'judges' && (
        <>
          <Section title="Judge Breaks" savedKey="judgeBreaks" savedMap={savedMap}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Max Judge Hours Without Break
              </label>
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={comp.maxJudgeHoursWithoutBreak ?? ''}
                onChange={e => {
                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                  saveField('maxJudgeHoursWithoutBreak', val, 'judgeBreaks');
                }}
                placeholder={`${siteDefaultBreakHours ?? 6}${siteDefaultBreakHours !== undefined ? ' (site default)' : ' (default)'}`}
                className="w-[160px] px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <small className="text-gray-500 text-sm mt-1 block">
                Override the site default ({siteDefaultBreakHours ?? 6}h) for this competition. Leave empty to use the {siteDefaultBreakHours !== undefined ? 'site' : 'system'} default.
              </small>
            </div>
          </Section>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Judge Schedule</h3>
            <p className="text-gray-500 text-sm mb-4">
              View each judge's assigned heats, working time, and break segments. Generate a schedule first to see assignments.
            </p>
            <JudgeScheduleView competitionId={competitionId} />
          </div>
        </>
      )}

      {/* ─── Billing Tab ─── */}
      {activeTab === 'billing' && (
        <>
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

          <AgeCategoriesSection
            comp={comp}
            savedMap={savedMap}
            organizations={organizations}
            orgName={orgName}
            ageCategories={ageCategories}
            setAgeCategories={setAgeCategories}
            saveAgeCategories={saveAgeCategories}
          />
        </>
      )}

      {/* ─── Access Tab ─── */}
      {activeTab === 'access' && (
        <>
          <VisibilityAccessSection
            comp={comp}
            savedMap={savedMap}
            saveField={saveField}
          />

          <CompetitionAdminsSection competitionId={competitionId} savedMap={savedMap} flashSaved={flashSaved} />
        </>
      )}
    </div>
  );
};

function DanceOrderSettingsSection({
  comp,
  savedMap,
  saveField,
}: {
  comp: { danceOrder?: Record<string, string[]> };
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}) {
  const danceOrder = comp.danceOrder || DEFAULT_DANCE_ORDER;
  const styles = Object.keys(danceOrder).length > 0 ? Object.keys(danceOrder) : Object.keys(DEFAULT_DANCE_ORDER);
  const [newDanceInputs, setNewDanceInputs] = useState<Record<string, string>>({});
  const [newStyleInput, setNewStyleInput] = useState('');

  const moveItem = (list: string[], fromIdx: number, direction: 'up' | 'down'): string[] => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= list.length) return list;
    const newList = [...list];
    [newList[fromIdx], newList[toIdx]] = [newList[toIdx], newList[fromIdx]];
    return newList;
  };

  const updateOrder = (newOrder: Record<string, string[]>) => {
    saveField('danceOrder', newOrder, 'dances');
  };

  const moveDance = (style: string, fromIdx: number, direction: 'up' | 'down') => {
    const dances = getDancesForStyle(style, danceOrder);
    const moved = moveItem(dances, fromIdx, direction);
    updateOrder({ ...danceOrder, [style]: moved });
  };

  const removeDance = (style: string, idx: number) => {
    const dances = [...getDancesForStyle(style, danceOrder)];
    dances.splice(idx, 1);
    updateOrder({ ...danceOrder, [style]: dances });
  };

  const addDance = (style: string) => {
    const name = (newDanceInputs[style] || '').trim();
    if (!name) return;
    const dances = [...getDancesForStyle(style, danceOrder)];
    if (dances.includes(name)) return;
    dances.push(name);
    updateOrder({ ...danceOrder, [style]: dances });
    setNewDanceInputs(prev => ({ ...prev, [style]: '' }));
  };

  return (
    <Section title="Dance Order" savedKey="dances" savedMap={savedMap}>
      <p className="text-gray-500 text-sm mb-3">
        Control the order dances appear in event forms and schedule generation. Add custom dances per style.
      </p>
      <div className="flex flex-col gap-3 max-w-md">
        {styles.map(style => {
          const dances = getDancesForStyle(style, danceOrder);
          return (
            <div key={style}>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-semibold text-gray-700">{style}</label>
                {!DEFAULT_STYLE_ORDER.includes(style) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newOrder = { ...danceOrder };
                      delete newOrder[style];
                      updateOrder(newOrder);
                    }}
                    className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                    title="Remove custom style"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {dances.map((dance, idx) => (
                  <div key={dance} className="flex items-center gap-1.5 py-1 px-2 bg-gray-50 border border-gray-100 rounded text-sm">
                    <span className="text-gray-400 min-w-[1.2rem] text-xs">{idx + 1}.</span>
                    <span className="flex-1">{dance}</span>
                    <button
                      type="button"
                      onClick={() => moveDance(style, idx, 'up')}
                      disabled={idx === 0}
                      className={`py-0 px-1 text-xs ${idx === 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDance(style, idx, 'down')}
                      disabled={idx === dances.length - 1}
                      className={`py-0 px-1 text-xs ${idx === dances.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'}`}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDance(style, idx)}
                      className="py-0 px-1 text-xs text-red-400 hover:text-red-600 cursor-pointer"
                      title="Remove dance"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input
                  type="text"
                  placeholder="Add custom dance..."
                  value={newDanceInputs[style] || ''}
                  onChange={(e) => setNewDanceInputs(prev => ({ ...prev, [style]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDance(style); } }}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                />
                <button
                  type="button"
                  onClick={() => addDance(style)}
                  className="px-2.5 py-1 bg-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-primary-600"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex gap-1.5 mt-2">
          <input
            type="text"
            placeholder="Add custom style..."
            value={newStyleInput}
            onChange={(e) => setNewStyleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const name = newStyleInput.trim();
                if (name && !styles.includes(name)) {
                  updateOrder({ ...danceOrder, [name]: [] });
                  setNewStyleInput('');
                }
              }
            }}
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const name = newStyleInput.trim();
              if (name && !styles.includes(name)) {
                updateOrder({ ...danceOrder, [name]: [] });
                setNewStyleInput('');
              }
            }}
            className="px-2.5 py-1 bg-primary-500 text-white rounded text-sm font-medium cursor-pointer hover:bg-primary-600"
          >
            Add Style
          </button>
        </div>
      </div>
    </Section>
  );
}

export default CompetitionSettingsPage;
