import { useState, useCallback } from 'react';
import axios from 'axios';
import { couplesApi, eventsApi } from '../../../api/client';
import { Event, AgeCategory, Competition, EventTemplate, Person, Couple } from '../../../types';
import { getDancesForStyle } from '../../../constants/dances';

/** Per-style selections for the multi-style registration UI */
export interface StyleSelections {
  levels: string[];
  ageCategories: string[];
  singleDances: string[];
  templateIds: string[];
  // Scholarship
  scholLevels: string[];
  scholAgeCategories: string[];
  scholTemplateIds: string[];
}

const emptyStyleSelections = (): StyleSelections => ({
  levels: [],
  ageCategories: [],
  singleDances: [],
  templateIds: [],
  scholLevels: [],
  scholAgeCategories: [],
  scholTemplateIds: [],
});

export interface RegistrationState {
  registerBib: number | null;
  regDesignation: string;
  regSyllabusType: string;
  regLevel: string;
  regStyle: string;
  regDances: string[];
  regScoringType: 'standard' | 'proficiency';
  regIsScholarship: boolean;
  regAgeCategory: string;
  regAgeCategories: string[];
  availableAgeCategories: AgeCategory[];
  regLoading: boolean;
  regMessage: string;
  regError: string;
  coupleEvents: Event[];
  coupleEventsLoading: boolean;
  setRegDesignation: (v: string) => void;
  setRegSyllabusType: (v: string) => void;
  setRegLevel: (v: string) => void;
  setRegStyle: (v: string) => void;
  setRegDances: React.Dispatch<React.SetStateAction<string[]>>;
  setRegScoringType: (v: 'standard' | 'proficiency') => void;
  setRegIsScholarship: (v: boolean) => void;
  setRegAgeCategory: (v: string) => void;
  setRegAgeCategories: React.Dispatch<React.SetStateAction<string[]>>;
  getDanceOptions: (style: string) => string[];
  openRegisterPanel: (bib: number) => void;
  handleRegister: (overrides?: { isScholarship?: boolean }) => void;
  handleRemoveEntry: (eventId: number) => void;
  // Batch registration (legacy single-style)
  regLevels: string[];
  setRegLevels: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSingleDances: string[];
  setSelectedSingleDances: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTemplateIds: string[];
  setSelectedTemplateIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkRegister: () => void;
  bulkResults: BulkResult[];
  hasScoringDefaults: boolean;
  // Scholarship batch (legacy)
  scholLevels: string[];
  setScholLevels: React.Dispatch<React.SetStateAction<string[]>>;
  scholAgeCategories: string[];
  setScholAgeCategories: React.Dispatch<React.SetStateAction<string[]>>;
  scholTemplateIds: string[];
  setScholTemplateIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkScholarshipRegister: () => void;
  // Multi-style registration
  expandedSingleStyles: string[];
  expandedMultiStyles: string[];
  perStyleSelections: Record<string, StyleSelections>;
  toggleSingleStyle: (style: string) => void;
  toggleMultiStyle: (style: string) => void;
  setStyleField: <K extends keyof StyleSelections>(style: string, field: K, value: StyleSelections[K]) => void;
  toggleStyleArrayItem: (style: string, field: keyof StyleSelections, item: string) => void;
  handleMultiStyleRegister: () => void;
}

export interface BulkResult {
  label: string;
  success: boolean;
  created?: boolean;
  error?: string;
}

/** Infer designation from leader/follower statuses */
function inferDesignation(leaderStatus?: string, followerStatus?: string): string {
  if (!leaderStatus || !followerStatus) return '';
  const isPro = (s: string) => s === 'professional';
  const isStudent = (s: string) => s === 'student';

  if ((isPro(leaderStatus) && isStudent(followerStatus)) ||
      (isStudent(leaderStatus) && isPro(followerStatus))) {
    return 'Pro-Am';
  }
  if (isStudent(leaderStatus) && isStudent(followerStatus)) {
    return 'Amateur';
  }
  if (isPro(leaderStatus) && isPro(followerStatus)) {
    return 'Professional';
  }
  return '';
}

export function useRegistrationPanel(
  competitionId: number,
  activeCompetition: Competition | null,
  people?: Person[],
  couples?: Couple[],
): RegistrationState {
  const [registerBib, setRegisterBib] = useState<number | null>(null);
  const [registerCoupleId, setRegisterCoupleId] = useState<number | null>(null);
  const [regDesignation, setRegDesignation] = useState('');
  const [regSyllabusType, setRegSyllabusType] = useState('');
  const [regLevel, setRegLevel] = useState('');
  const [regStyle, setRegStyle] = useState('');
  const [regDances, setRegDances] = useState<string[]>([]);
  const [regScoringType, setRegScoringType] = useState<'standard' | 'proficiency'>(
    activeCompetition?.defaultScoringType || 'standard'
  );
  const [regIsScholarship, setRegIsScholarship] = useState(false);
  const [regAgeCategory, setRegAgeCategory] = useState('');
  const [regAgeCategories, setRegAgeCategories] = useState<string[]>([]);
  const [availableAgeCategories] = useState<AgeCategory[]>(
    activeCompetition?.ageCategories?.length ? activeCompetition.ageCategories : []
  );
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [regError, setRegError] = useState('');
  const [coupleEvents, setCoupleEvents] = useState<Event[]>([]);
  const [coupleEventsLoading, setCoupleEventsLoading] = useState(false);

  // Legacy batch state
  const [regLevels, setRegLevels] = useState<string[]>([]);
  const [selectedSingleDances, setSelectedSingleDances] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  // Legacy scholarship batch state
  const [scholLevels, setScholLevels] = useState<string[]>([]);
  const [scholAgeCategories, setScholAgeCategories] = useState<string[]>([]);
  const [scholTemplateIds, setScholTemplateIds] = useState<string[]>([]);

  // Multi-style state
  const [expandedSingleStyles, setExpandedSingleStyles] = useState<string[]>([]);
  const [expandedMultiStyles, setExpandedMultiStyles] = useState<string[]>([]);
  const [perStyleSelections, setPerStyleSelections] = useState<Record<string, StyleSelections>>({});

  const getDanceOptions = (s: string) => getDancesForStyle(s, activeCompetition?.danceOrder);

  const toggleSingleStyle = useCallback((style: string) => {
    setExpandedSingleStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
    // Ensure style has a selections entry
    setPerStyleSelections(prev => prev[style] ? prev : { ...prev, [style]: emptyStyleSelections() });
  }, []);

  const toggleMultiStyle = useCallback((style: string) => {
    setExpandedMultiStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
    setPerStyleSelections(prev => prev[style] ? prev : { ...prev, [style]: emptyStyleSelections() });
  }, []);

  const setStyleField = useCallback(<K extends keyof StyleSelections>(
    style: string, field: K, value: StyleSelections[K]
  ) => {
    setPerStyleSelections(prev => ({
      ...prev,
      [style]: { ...(prev[style] || emptyStyleSelections()), [field]: value },
    }));
  }, []);

  const toggleStyleArrayItem = useCallback((style: string, field: keyof StyleSelections, item: string) => {
    setPerStyleSelections(prev => {
      const current = prev[style] || emptyStyleSelections();
      const arr = current[field] as string[];
      const newArr = arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
      return { ...prev, [style]: { ...current, [field]: newArr } };
    });
  }, []);

  const openRegisterPanel = async (bib: number) => {
    if (registerBib === bib) {
      setRegisterBib(null);
      setRegisterCoupleId(null);
      return;
    }
    setRegisterBib(bib);

    // Infer designation from leader/follower statuses
    let defaultDesignation = '';
    let coupleId: number | null = null;
    if (couples && people) {
      const couple = couples.find(c => c.bib === bib);
      if (couple) {
        coupleId = couple.id;
        const leader = people.find(p => p.id === couple.leaderId);
        const follower = people.find(p => p.id === couple.followerId);
        defaultDesignation = inferDesignation(leader?.status, follower?.status);
      }
    }
    setRegisterCoupleId(coupleId);
    setRegDesignation(defaultDesignation);
    setRegSyllabusType('');
    setRegLevel('');
    setRegStyle('');
    setRegDances([]);
    setRegScoringType(activeCompetition?.defaultScoringType || 'standard');
    setRegIsScholarship(false);
    setRegAgeCategory('');
    setRegMessage('');
    setRegError('');
    setRegLevels([]);
    setRegAgeCategories([]);
    setSelectedSingleDances([]);
    setSelectedTemplateIds([]);
    setBulkResults([]);
    setScholLevels([]);
    setScholAgeCategories([]);
    setScholTemplateIds([]);
    // Reset multi-style state
    setExpandedSingleStyles([]);
    setExpandedMultiStyles([]);
    setPerStyleSelections({});
    setCoupleEventsLoading(true);
    try {
      if (coupleId) {
        const res = await couplesApi.getEvents(coupleId);
        setCoupleEvents(res.data);
      } else {
        setCoupleEvents([]);
      }
    } catch {
      setCoupleEvents([]);
    } finally {
      setCoupleEventsLoading(false);
    }
  };

  const handleRegister = async (overrides?: { isScholarship?: boolean }) => {
    if (!registerBib || !competitionId) return;
    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    const scholarship = overrides?.isScholarship ?? regIsScholarship;
    try {
      const res = await eventsApi.register({
        competitionId,
        bib: registerBib,
        designation: regDesignation || undefined,
        syllabusType: regSyllabusType || undefined,
        level: regLevel || undefined,
        style: regStyle || undefined,
        dances: regDances.length > 0 ? regDances : undefined,
        scoringType: regScoringType,
        isScholarship: scholarship || undefined,
        ageCategory: regAgeCategory || undefined,
      });
      const action = res.data.created ? 'Created & registered for' : 'Registered for';
      setRegMessage(`${action} ${res.data.event.name}`);
      // Refresh couple events
      const evRes = await couplesApi.getEvents(registerCoupleId!);
      setCoupleEvents(evRes.data);
    } catch (err: unknown) {
      setRegError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to register' : 'Failed to register');
    } finally {
      setRegLoading(false);
    }
  };

  const handleBulkRegister = async () => {
    if (!registerBib || !competitionId || !regStyle) return;
    const templates = activeCompetition?.eventTemplates || [];

    // Split entries into leveled and no-level
    const leveledEntries: Array<{ dances: string[]; label: string }> = [];
    const noLevelEntries: Array<{ dances: string[]; label: string }> = [];

    for (const dance of selectedSingleDances) {
      leveledEntries.push({ dances: [dance], label: dance });
    }
    for (const tplId of selectedTemplateIds) {
      const tpl = templates.find((t: EventTemplate) => t.id === tplId);
      if (tpl) {
        if (tpl.noLevel) {
          noLevelEntries.push({ dances: tpl.dances, label: tpl.name });
        } else {
          leveledEntries.push({ dances: tpl.dances, label: tpl.name });
        }
      }
    }

    // Need either leveled entries with levels selected, or no-level entries
    if (leveledEntries.length === 0 && noLevelEntries.length === 0) return;
    if (leveledEntries.length > 0 && regLevels.length === 0) return;

    const ageCategoriesToUse = regAgeCategories.length > 0
      ? regAgeCategories
      : regAgeCategory ? [regAgeCategory] : [''];

    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    setBulkResults([]);

    const results: BulkResult[] = [];

    // Register leveled entries (level × age × entry)
    for (const ageCat of ageCategoriesToUse) {
      for (const level of regLevels) {
        for (const entry of leveledEntries) {
          const label = `${ageCat ? ageCat + ' ' : ''}${level} ${entry.label}`;
          try {
            const res = await eventsApi.register({
              competitionId,
              bib: registerBib,
              designation: regDesignation || undefined,
              syllabusType: regSyllabusType || undefined,
              level,
              style: regStyle,
              dances: entry.dances,
              scoringType: regScoringType,
              ageCategory: ageCat || undefined,
            });
            results.push({
              label: res.data.event.name,
              success: true,
              created: res.data.created,
            });
          } catch (err: unknown) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Failed' : 'Failed';
            results.push({ label, success: false, error: msg });
          }
        }
      }

      // Register no-level entries (age × entry only, no level loop)
      for (const entry of noLevelEntries) {
        const label = `${ageCat ? ageCat + ' ' : ''}${entry.label}`;
        try {
          const res = await eventsApi.register({
            competitionId,
            bib: registerBib,
            designation: regDesignation || undefined,
            syllabusType: regSyllabusType || undefined,
            style: regStyle,
            dances: entry.dances,
            scoringType: regScoringType,
            ageCategory: ageCat || undefined,
          });
          results.push({
            label: res.data.event.name,
            success: true,
            created: res.data.created,
          });
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Failed' : 'Failed';
          results.push({ label, success: false, error: msg });
        }
      }
    }

    setBulkResults(results);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    if (failCount === 0) {
      setRegMessage(`Registered for ${successCount} event${successCount !== 1 ? 's' : ''}`);
    } else if (successCount === 0) {
      setRegError(`All ${failCount} registrations failed`);
    } else {
      setRegMessage(`${successCount} registered, ${failCount} failed`);
    }

    // Refresh couple events
    try {
      const evRes = await couplesApi.getEvents(registerCoupleId!);
      setCoupleEvents(evRes.data);
    } catch { /* ignore */ }

    setRegLoading(false);
  };

  const handleBulkScholarshipRegister = async () => {
    if (!registerBib || !competitionId || scholLevels.length === 0 || !regStyle) return;
    const templates = activeCompetition?.scholarshipTemplates || [];

    // Build entries from scholarship templates
    const entries: Array<{ dances: string[]; label: string }> = [];
    for (const tplId of scholTemplateIds) {
      const tpl = templates.find((t: EventTemplate) => t.id === tplId);
      if (tpl) {
        entries.push({ dances: tpl.dances, label: tpl.name });
      }
    }

    if (entries.length === 0) return;

    const ageCategoriesToUse = scholAgeCategories.length > 0
      ? scholAgeCategories
      : regAgeCategory ? [regAgeCategory] : [''];

    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    setBulkResults([]);

    const results: BulkResult[] = [];

    for (const ageCat of ageCategoriesToUse) {
      for (const level of scholLevels) {
        for (const entry of entries) {
          const label = `${ageCat ? ageCat + ' ' : ''}${level} ${entry.label} (Scholarship)`;
          try {
            const res = await eventsApi.register({
              competitionId,
              bib: registerBib,
              designation: regDesignation || undefined,
              syllabusType: regSyllabusType || undefined,
              level,
              style: regStyle,
              dances: entry.dances,
              scoringType: regScoringType,
              isScholarship: true,
              ageCategory: ageCat || undefined,
            });
            results.push({
              label: res.data.event.name,
              success: true,
              created: res.data.created,
            });
          } catch (err: unknown) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Failed' : 'Failed';
            results.push({ label, success: false, error: msg });
          }
        }
      }
    }

    setBulkResults(results);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    if (failCount === 0) {
      setRegMessage(`Registered for ${successCount} scholarship event${successCount !== 1 ? 's' : ''}`);
    } else if (successCount === 0) {
      setRegError(`All ${failCount} scholarship registrations failed`);
    } else {
      setRegMessage(`${successCount} registered, ${failCount} failed`);
    }

    try {
      const evRes = await couplesApi.getEvents(registerCoupleId!);
      setCoupleEvents(evRes.data);
    } catch { /* ignore */ }

    setRegLoading(false);
  };

  /** Build the entries array from perStyleSelections for bulk register */
  function buildBulkEntries(): Array<{
    designation?: string; syllabusType?: string; level?: string;
    style?: string; dances?: string[]; scoringType?: string;
    isScholarship?: boolean; ageCategory?: string;
  }> {
    const templates = activeCompetition?.eventTemplates || [];
    const scholTemplates = activeCompetition?.scholarshipTemplates || [];
    const entries: Array<{
      designation?: string; syllabusType?: string; level?: string;
      style?: string; dances?: string[]; scoringType?: string;
      isScholarship?: boolean; ageCategory?: string;
    }> = [];

    for (const [style, sel] of Object.entries(perStyleSelections)) {
      const ageCats = sel.ageCategories.length > 0 ? sel.ageCategories : [''];

      // Single dances (leveled)
      if (sel.singleDances.length > 0 && sel.levels.length > 0) {
        for (const ageCat of ageCats) {
          for (const level of sel.levels) {
            for (const dance of sel.singleDances) {
              entries.push({
                designation: regDesignation || undefined,
                syllabusType: regSyllabusType || undefined,
                level, style, dances: [dance],
                scoringType: regScoringType,
                ageCategory: ageCat || undefined,
              });
            }
          }
        }
      }

      // Multi-dance templates
      for (const tplId of sel.templateIds) {
        const tpl = templates.find((t: EventTemplate) => t.id === tplId);
        if (!tpl) continue;
        if (tpl.noLevel) {
          for (const ageCat of ageCats) {
            entries.push({
              designation: regDesignation || undefined,
              syllabusType: regSyllabusType || undefined,
              style, dances: tpl.dances,
              scoringType: regScoringType,
              ageCategory: ageCat || undefined,
            });
          }
        } else if (sel.levels.length > 0) {
          for (const ageCat of ageCats) {
            for (const level of sel.levels) {
              entries.push({
                designation: regDesignation || undefined,
                syllabusType: regSyllabusType || undefined,
                level, style, dances: tpl.dances,
                scoringType: regScoringType,
                ageCategory: ageCat || undefined,
              });
            }
          }
        }
      }

      // Scholarship templates
      const scholAgeCats = sel.scholAgeCategories.length > 0 ? sel.scholAgeCategories : [''];
      if (sel.scholLevels.length > 0 && sel.scholTemplateIds.length > 0) {
        for (const ageCat of scholAgeCats) {
          for (const level of sel.scholLevels) {
            for (const tplId of sel.scholTemplateIds) {
              const tpl = scholTemplates.find((t: EventTemplate) => t.id === tplId);
              if (!tpl) continue;
              entries.push({
                designation: regDesignation || undefined,
                syllabusType: regSyllabusType || undefined,
                level, style, dances: tpl.dances,
                scoringType: regScoringType,
                isScholarship: true,
                ageCategory: ageCat || undefined,
              });
            }
          }
        }
      }
    }

    return entries;
  }

  /** Multi-style bulk register: single API call for all entries */
  const handleMultiStyleRegister = async () => {
    if (!registerBib || !competitionId) return;

    const entries = buildBulkEntries();
    if (entries.length === 0) return;

    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    setBulkResults([]);

    try {
      const res = await eventsApi.bulkRegister({
        competitionId,
        bib: registerBib,
        entries,
      });

      const serverResults = res.data.results;
      const mapped: BulkResult[] = serverResults.map(r => ({
        label: r.eventName || r.label,
        success: r.success,
        created: r.created,
        error: r.error,
      }));

      setBulkResults(mapped);
      const successCount = mapped.filter(r => r.success).length;
      const failCount = mapped.filter(r => !r.success).length;
      if (failCount === 0) {
        setRegMessage(`Registered for ${successCount} event${successCount !== 1 ? 's' : ''}`);
      } else if (successCount === 0) {
        setRegError(`All ${failCount} registrations failed`);
      } else {
        setRegMessage(`${successCount} registered, ${failCount} failed`);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Bulk registration failed' : 'Bulk registration failed';
      setRegError(msg);
    }

    // Refresh couple events
    try {
      const evRes = await couplesApi.getEvents(registerCoupleId!);
      setCoupleEvents(evRes.data);
    } catch { /* ignore */ }

    setRegLoading(false);
  };

  const handleRemoveEntry = async (eventId: number) => {
    if (!registerBib) return;
    try {
      await eventsApi.removeEntry(eventId, registerBib);
      const evRes = await couplesApi.getEvents(registerCoupleId!);
      setCoupleEvents(evRes.data);
    } catch (err: unknown) {
      setRegError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to remove entry' : 'Failed to remove entry');
    }
  };

  return {
    registerBib,
    regDesignation,
    regSyllabusType,
    regLevel,
    regStyle,
    regDances,
    regScoringType,
    regIsScholarship,
    regAgeCategory,
    regAgeCategories,
    availableAgeCategories,
    regLoading,
    regMessage,
    regError,
    coupleEvents,
    coupleEventsLoading,
    setRegDesignation,
    setRegSyllabusType,
    setRegLevel,
    setRegStyle,
    setRegDances,
    setRegScoringType,
    setRegIsScholarship,
    setRegAgeCategory,
    setRegAgeCategories,
    getDanceOptions,
    openRegisterPanel,
    handleRegister,
    handleRemoveEntry,
    // Batch
    regLevels,
    setRegLevels,
    selectedSingleDances,
    setSelectedSingleDances,
    selectedTemplateIds,
    setSelectedTemplateIds,
    handleBulkRegister,
    bulkResults,
    hasScoringDefaults: !!(activeCompetition?.scoringTypeDefaults &&
      Object.values(activeCompetition.scoringTypeDefaults).some(Boolean)),
    // Scholarship batch
    scholLevels,
    setScholLevels,
    scholAgeCategories,
    setScholAgeCategories,
    scholTemplateIds,
    setScholTemplateIds,
    handleBulkScholarshipRegister,
    // Multi-style
    expandedSingleStyles,
    expandedMultiStyles,
    perStyleSelections,
    toggleSingleStyle,
    toggleMultiStyle,
    setStyleField,
    toggleStyleArrayItem,
    handleMultiStyleRegister,
  };
}
