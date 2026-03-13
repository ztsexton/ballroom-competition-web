import { useState, useEffect, useRef, useCallback } from 'react';
import { competitionsApi, organizationsApi, settingsApi, eventsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { useToast } from '../../context/ToastContext';
import { CompetitionType, AgeCategory, Organization, ScheduleDayConfig } from '../../types';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DEFAULT_LEVELS } from '../../constants/levels';
import { DEFAULT_DANCE_ORDER, getDancesForStyle } from '../../constants/dances';
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
  { key: 'schedule', label: 'Schedule' },
  { key: 'judges', label: 'Judges' },
  { key: 'billing', label: 'Billing' },
  { key: 'access', label: 'Access' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── Main Page ───

const CompetitionSettingsPage = () => {
  const { activeCompetition, setActiveCompetition } = useCompetition();
  const { showToast } = useToast();
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
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
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
      showToast(`Failed to save ${field}`, 'error');
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
      showToast('Failed to save levels', 'error');
    }
  };

  const isOrgActive = (targetOrg: Organization | null, targetType: CompetitionType) => {
    if (targetOrg) return activeCompetition?.organizationId === targetOrg.id;
    return !activeCompetition?.organizationId && activeCompetition?.type === targetType;
  };

  const confirmOrgSwitch = (label: string, hasOrg: boolean, onConfirm: () => void) => {
    const message =
      `Switch to ${label}? This will update the competition type and age categories.` +
      (hasOrg ? ' Default settings will be applied where you haven\'t made custom changes.' : '');
    setConfirmAction({ message, onConfirm });
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
      showToast('Failed to save age categories', 'error');
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <AgeCategoriesSection
            comp={comp}
            savedMap={savedMap}
            organizations={organizations}
            orgName={orgName}
            ageCategories={ageCategories}
            setAgeCategories={setAgeCategories}
            saveAgeCategories={saveAgeCategories}
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
            competitionId={competitionId}
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

      {/* ─── Schedule Tab ─── */}
      {activeTab === 'schedule' && (
        <>
          <Section title="Competition Time Window" savedKey="schedule" savedMap={savedMap}>
            <p className="text-gray-500 text-sm mb-3">
              Set the start and end times for your competition day(s). The schedule generator uses these to calculate timing and detect overflow.
            </p>
            <div className="flex flex-col gap-4 max-w-[500px]">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-600 w-24">Days</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={comp.scheduleDayConfigs?.length || 1}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 1;
                    const existing = comp.scheduleDayConfigs || [];
                    const newConfigs: ScheduleDayConfig[] = [];
                    for (let i = 0; i < count; i++) {
                      newConfigs.push(existing[i] || { day: i + 1, startTime: '08:00', endTime: '17:00' });
                    }
                    newConfigs.forEach((c, i) => c.day = i + 1);
                    saveField('scheduleDayConfigs', newConfigs, 'schedule');
                  }}
                  className="w-16 p-1.5 rounded border border-gray-200 text-center text-sm"
                />
              </div>
              {(comp.scheduleDayConfigs || [{ day: 1, startTime: '08:00', endTime: '17:00' }]).map((config, idx) => {
                const renderTimePicker = (value: string, onChange: (time: string) => void) => {
                  const [h, m] = value.split(':').map(Number);
                  let hour12 = h;
                  let period: 'AM' | 'PM' = 'AM';
                  if (h === 0) { hour12 = 12; period = 'AM'; }
                  else if (h < 12) { hour12 = h; period = 'AM'; }
                  else if (h === 12) { hour12 = 12; period = 'PM'; }
                  else { hour12 = h - 12; period = 'PM'; }
                  const minute = m;

                  const buildTime = (h12: number, min: number, p: 'AM' | 'PM') => {
                    let h24 = h12;
                    if (p === 'AM' && h12 === 12) h24 = 0;
                    else if (p === 'PM' && h12 !== 12) h24 = h12 + 12;
                    return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                  };

                  return (
                    <div className="flex items-center gap-1">
                      <select
                        value={hour12}
                        onChange={(e) => onChange(buildTime(parseInt(e.target.value), minute, period))}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white"
                      >
                        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hv => (
                          <option key={hv} value={hv}>{hv}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 font-semibold">:</span>
                      <select
                        value={minute}
                        onChange={(e) => onChange(buildTime(hour12, parseInt(e.target.value), period))}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white"
                      >
                        {[0, 15, 30, 45].map(mv => (
                          <option key={mv} value={mv}>{String(mv).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={period}
                        onChange={(e) => onChange(buildTime(hour12, minute, e.target.value as 'AM' | 'PM'))}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white font-medium"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  );
                };

                return (
                  <div key={idx} className="flex items-center gap-3">
                    {(comp.scheduleDayConfigs?.length || 1) > 1 && (
                      <label className="font-semibold text-sm min-w-[3.5rem]">Day {config.day}</label>
                    )}
                    {(comp.scheduleDayConfigs?.length || 1) === 1 && (
                      <label className="text-sm text-gray-600">Start</label>
                    )}
                    {renderTimePicker(config.startTime, (time) => {
                      const configs = [...(comp.scheduleDayConfigs || [{ day: 1, startTime: '08:00', endTime: '17:00' }])];
                      configs[idx] = { ...configs[idx], startTime: time };
                      saveField('scheduleDayConfigs', configs, 'schedule');
                    })}
                    <span className="text-gray-400">to</span>
                    {renderTimePicker(config.endTime, (time) => {
                      const configs = [...(comp.scheduleDayConfigs || [{ day: 1, startTime: '08:00', endTime: '17:00' }])];
                      configs[idx] = { ...configs[idx], endTime: time };
                      saveField('scheduleDayConfigs', configs, 'schedule');
                    })}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Hard Stop Time" savedKey="hardStop" savedMap={savedMap}>
            <p className="text-gray-500 text-sm mb-3">
              Set an absolute deadline when the competition must end (e.g. venue closing, local regulations). The schedule analyzer will warn and suggest adjustments if the schedule exceeds this time.
            </p>
            {(() => {
              const enabled = !!comp.hardStopTime;
              const current = comp.hardStopTime || '17:00';
              const [h, m] = current.split(':').map(Number);
              let hour12 = h;
              let period: 'AM' | 'PM' = 'AM';
              if (h === 0) { hour12 = 12; period = 'AM'; }
              else if (h < 12) { hour12 = h; period = 'AM'; }
              else if (h === 12) { hour12 = 12; period = 'PM'; }
              else { hour12 = h - 12; period = 'PM'; }
              const minute = m;

              const buildTime = (h12: number, min: number, p: 'AM' | 'PM') => {
                let h24 = h12;
                if (p === 'AM' && h12 === 12) h24 = 0;
                else if (p === 'PM' && h12 !== 12) h24 = h12 + 12;
                return `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
              };

              return (
                <div className="flex flex-col gap-3 max-w-[400px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          saveField('hardStopTime', '17:00', 'hardStop');
                        } else {
                          saveField('hardStopTime', null, 'hardStop');
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="font-semibold text-sm">Enable hard stop</span>
                  </label>
                  {enabled && (
                    <div className="flex items-center gap-2 ml-6">
                      <select
                        value={hour12}
                        onChange={(e) => saveField('hardStopTime', buildTime(parseInt(e.target.value), minute, period), 'hardStop')}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white"
                      >
                        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hv => (
                          <option key={hv} value={hv}>{hv}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 font-semibold">:</span>
                      <select
                        value={minute}
                        onChange={(e) => saveField('hardStopTime', buildTime(hour12, parseInt(e.target.value), period), 'hardStop')}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white"
                      >
                        {[0, 15, 30, 45].map(mv => (
                          <option key={mv} value={mv}>{String(mv).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <select
                        value={period}
                        onChange={(e) => saveField('hardStopTime', buildTime(hour12, minute, e.target.value as 'AM' | 'PM'), 'hardStop')}
                        className="p-1.5 rounded border border-gray-200 text-sm bg-white font-medium"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  )}
                  {!enabled && (
                    <p className="text-xs text-gray-400 ml-6">No hard stop set. The schedule end time is informational only.</p>
                  )}
                </div>
              );
            })()}
          </Section>
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

      <ConfirmDialog
        open={!!confirmAction}
        title="Switch Organization"
        message={confirmAction?.message || ''}
        confirmLabel="Switch"
        variant="warning"
        onConfirm={() => {
          confirmAction?.onConfirm();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

function DanceOrderSettingsSection({
  comp,
  competitionId,
  savedMap,
  saveField,
}: {
  comp: { danceOrder?: Record<string, string[]> };
  competitionId: number;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}) {
  const { showToast } = useToast();
  const danceOrder = comp.danceOrder || DEFAULT_DANCE_ORDER;
  const styles = Object.keys(danceOrder).length > 0 ? Object.keys(danceOrder) : Object.keys(DEFAULT_DANCE_ORDER);
  const [newDanceInputs, setNewDanceInputs] = useState<Record<string, string>>({});
  const [newStyleInput, setNewStyleInput] = useState('');
  const [editingStyle, setEditingStyle] = useState<string | null>(null);
  const [editingStyleName, setEditingStyleName] = useState('');
  const [renaming, setRenaming] = useState(false);

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

  const renameStyle = async (oldName: string) => {
    const newName = editingStyleName.trim();
    if (!newName || newName === oldName || styles.includes(newName)) {
      setEditingStyle(null);
      return;
    }
    setRenaming(true);
    try {
      // Update danceOrder: replace old key with new key, preserving order
      const newOrder: Record<string, string[]> = {};
      for (const key of Object.keys(danceOrder)) {
        if (key === oldName) {
          newOrder[newName] = danceOrder[oldName];
        } else {
          newOrder[key] = danceOrder[key];
        }
      }
      updateOrder(newOrder);

      // Bulk-update events that reference the old style name
      const eventsRes = await eventsApi.getAll(competitionId);
      const events = Object.values(eventsRes.data);
      const toUpdate = events.filter(e => e.style === oldName);
      await Promise.all(toUpdate.map(e => eventsApi.update(e.id, { style: newName })));
    } finally {
      setRenaming(false);
      setEditingStyle(null);
    }
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
                {editingStyle === style ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editingStyleName}
                      onChange={(e) => setEditingStyleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); renameStyle(style); }
                        if (e.key === 'Escape') setEditingStyle(null);
                      }}
                      disabled={renaming}
                      autoFocus
                      className="px-2 py-0.5 border border-primary-300 rounded text-sm font-semibold w-40"
                    />
                    <button
                      type="button"
                      onClick={() => renameStyle(style)}
                      disabled={renaming}
                      className="text-xs text-primary-600 hover:text-primary-800 cursor-pointer font-medium"
                    >
                      {renaming ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStyle(null)}
                      disabled={renaming}
                      className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="block text-sm font-semibold text-gray-700">{style}</label>
                    <button
                      type="button"
                      onClick={() => { setEditingStyle(style); setEditingStyleName(style); }}
                      className="text-xs text-gray-400 hover:text-primary-600 cursor-pointer"
                      title="Rename style"
                    >
                      Rename
                    </button>
                  </>
                )}
                {editingStyle !== style && (
                  <button
                    type="button"
                    onClick={() => {
                      const newOrder = { ...danceOrder };
                      delete newOrder[style];
                      updateOrder(newOrder);
                    }}
                    className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                    title="Remove style"
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
        <div className="mt-3 pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={async () => {
              setRenaming(true);
              try {
                const res = await eventsApi.reorderDances(competitionId);
                showToast(res.data.updated > 0 ? `Updated ${res.data.updated} event(s)` : 'All events already in correct order', 'success');
              } catch {
                showToast('Failed to reorder dances', 'error');
              } finally {
                setRenaming(false);
              }
            }}
            disabled={renaming}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm cursor-pointer hover:bg-gray-200 disabled:opacity-50"
          >
            {renaming ? 'Updating...' : 'Reorder dances in existing event names'}
          </button>
          <p className="text-gray-400 text-xs mt-1">
            Updates existing events so dances appear in the configured order above.
          </p>
        </div>
      </div>
    </Section>
  );
}

export default CompetitionSettingsPage;
