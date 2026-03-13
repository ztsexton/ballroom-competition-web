import { useState } from 'react';
import axios from 'axios';
import { couplesApi, eventsApi } from '../../../api/client';
import { Event, AgeCategory, Competition, EventTemplate } from '../../../types';
import { getDancesForStyle } from '../../../constants/dances';

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
  getDanceOptions: (style: string) => string[];
  openRegisterPanel: (bib: number) => void;
  handleRegister: (overrides?: { isScholarship?: boolean }) => void;
  handleRemoveEntry: (eventId: number) => void;
  // Batch registration
  regLevels: string[];
  setRegLevels: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSingleDances: string[];
  setSelectedSingleDances: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTemplateIds: string[];
  setSelectedTemplateIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkRegister: () => void;
  bulkResults: BulkResult[];
}

export interface BulkResult {
  label: string;
  success: boolean;
  created?: boolean;
  error?: string;
}

export function useRegistrationPanel(
  competitionId: number,
  activeCompetition: Competition | null,
): RegistrationState {
  const [registerBib, setRegisterBib] = useState<number | null>(null);
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
  const [availableAgeCategories] = useState<AgeCategory[]>(
    activeCompetition?.ageCategories?.length ? activeCompetition.ageCategories : []
  );
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState('');
  const [regError, setRegError] = useState('');
  const [coupleEvents, setCoupleEvents] = useState<Event[]>([]);
  const [coupleEventsLoading, setCoupleEventsLoading] = useState(false);

  // Batch state
  const [regLevels, setRegLevels] = useState<string[]>([]);
  const [selectedSingleDances, setSelectedSingleDances] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  const getDanceOptions = (s: string) => getDancesForStyle(s, activeCompetition?.danceOrder);

  const openRegisterPanel = async (bib: number) => {
    if (registerBib === bib) {
      setRegisterBib(null);
      return;
    }
    setRegisterBib(bib);
    setRegDesignation('');
    setRegSyllabusType('');
    setRegLevel('');
    setRegStyle('');
    setRegDances([]);
    setRegScoringType(activeCompetition?.defaultScoringType || 'standard');
    setRegIsScholarship(false);
    setRegMessage('');
    setRegError('');
    setRegLevels([]);
    setSelectedSingleDances([]);
    setSelectedTemplateIds([]);
    setBulkResults([]);
    setCoupleEventsLoading(true);
    try {
      const res = await couplesApi.getEvents(bib);
      setCoupleEvents(res.data);
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
      const evRes = await couplesApi.getEvents(registerBib);
      setCoupleEvents(evRes.data);
    } catch (err: unknown) {
      setRegError(axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to register' : 'Failed to register');
    } finally {
      setRegLoading(false);
    }
  };

  const handleBulkRegister = async () => {
    if (!registerBib || !competitionId || regLevels.length === 0 || !regStyle) return;
    const templates = activeCompetition?.eventTemplates || [];

    // Build list of entries: each single dance + each selected template
    const entries: Array<{ dances: string[]; label: string }> = [];
    for (const dance of selectedSingleDances) {
      entries.push({ dances: [dance], label: dance });
    }
    for (const tplId of selectedTemplateIds) {
      const tpl = templates.find((t: EventTemplate) => t.id === tplId);
      if (tpl) {
        entries.push({ dances: tpl.dances, label: tpl.name });
      }
    }

    if (entries.length === 0) return;

    setRegLoading(true);
    setRegMessage('');
    setRegError('');
    setBulkResults([]);

    const results: BulkResult[] = [];

    for (const level of regLevels) {
      for (const entry of entries) {
        const label = `${level} ${entry.label}`;
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
            ageCategory: regAgeCategory || undefined,
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
      const evRes = await couplesApi.getEvents(registerBib);
      setCoupleEvents(evRes.data);
    } catch { /* ignore */ }

    setRegLoading(false);
  };

  const handleRemoveEntry = async (eventId: number) => {
    if (!registerBib) return;
    try {
      await eventsApi.removeEntry(eventId, registerBib);
      const evRes = await couplesApi.getEvents(registerBib);
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
  };
}
