import { useState } from 'react';
import axios from 'axios';
import { couplesApi, eventsApi } from '../../../api/client';
import { Event, AgeCategory, Competition } from '../../../types';
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
  handleRegister: () => void;
  handleRemoveEntry: (eventId: number) => void;
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

  const handleRegister = async () => {
    if (!registerBib || !competitionId) return;
    setRegLoading(true);
    setRegMessage('');
    setRegError('');
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
        isScholarship: regIsScholarship || undefined,
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
  };
}
