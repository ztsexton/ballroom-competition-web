import axios from 'axios';
import { Person, Couple, Judge, JudgeProfile, Event, EventResult, Competition, CompetitionAdmin, Studio, Organization, User, UserProfileUpdate, CompetitionSchedule, JudgeSettings, TimingSettings, ActiveHeatInfo, ScoringProgress, HeatEntry, InvoiceSummary, EntryPayment, PendingEntry, MindbodyClient, PublicCompetition, PublicEvent, PublicEventSearchResult, PublicEventWithHeats, AgeCategory, DetailedResultsResponse, AutoBreaksConfig, LevelCombiningConfig, SiteSettings, JudgeScheduleEntry, ScheduleVariant, PersonResultsResponse, PersonHeatListResponse } from '../types';
import { auth } from '../config/firebase';

// Derive API URL from base path (handles subpath deployments like /ballroomcomp)
// VITE_API_URL can override if API is hosted separately
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Use import.meta.env.BASE_URL which Vite sets from the `base` config
  const basePath = import.meta.env.BASE_URL || '/';
  // Ensure no double slashes: /ballroomcomp/ + api = /ballroomcomp/api
  return `${basePath.replace(/\/$/, '')}/api`;
};
const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Staging bypass flag — set at runtime from the backend, checked by interceptor
let _stagingBypassActive = false;
export function setStagingBypassActive(enabled: boolean) { _stagingBypassActive = enabled; }
export function isStagingBypassActive() { return _stagingBypassActive; }

// Add Firebase ID token to all requests (skipped when staging bypass is active)
api.interceptors.request.use(
  async (config) => {
    if (_stagingBypassActive) return config; // Backend handles auth bypass
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Competitions API
export const competitionsApi = {
  getAll: () => api.get<Competition[]>('/competitions'),
  getById: (id: number) => api.get<Competition>(`/competitions/${id}`),
  getSummary: (id: number) => api.get<{
    competition: Competition;
    counts: { people: number; couples: number; judges: number; events: number; totalEntries: number };
    schedule: { scheduleHeats: number; currentHeatIndex: number; completedCount: number; scheduleExists: boolean };
  }>(`/competitions/${id}/summary`),
  create: (competition: Omit<Competition, 'id' | 'createdAt'>) =>
    api.post<Competition>('/competitions', competition),
  update: (id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>) =>
    api.put<Competition>(`/competitions/${id}`, updates),
  delete: (id: number) => api.delete(`/competitions/${id}`),
  getAdmins: (id: number) => api.get<(CompetitionAdmin & { email?: string; displayName?: string; firstName?: string; lastName?: string })[]>(`/competitions/${id}/admins`),
  addAdmin: (id: number, email: string, role?: string) => api.post<CompetitionAdmin & { email?: string; displayName?: string }>(`/competitions/${id}/admins`, { email, role }),
  removeAdmin: (id: number, uid: string) => api.delete(`/competitions/${id}/admins/${uid}`),
  getValidationIssues: (id: number) => api.get<{
    issues: Array<{
      eventId: number;
      eventName: string;
      eventLevel: string;
      bib: number;
      leaderName: string;
      followerName: string;
      coupleLevel: string | null;
      allowedLevels: string[];
      reason: string;
    }>;
    count: number;
  }>(`/competitions/${id}/validation-issues`),
  getPendingEntries: (id: number) => api.get<{
    pendingEntries: Array<{
      id: string;
      bib: number;
      competitionId: number;
      combination: {
        designation?: string;
        syllabusType?: string;
        level?: string;
        style?: string;
        dances?: string[];
        scoringType?: string;
        ageCategory?: string;
      };
      reason: string;
      requestedAt: string;
      leaderName: string;
      followerName: string;
    }>;
    count: number;
  }>(`/competitions/${id}/pending-entries`),
  approvePendingEntry: (competitionId: number, entryId: string) =>
    api.post(`/competitions/${competitionId}/pending-entries/${entryId}/approve`),
  rejectPendingEntry: (competitionId: number, entryId: string) =>
    api.delete(`/competitions/${competitionId}/pending-entries/${entryId}`),
  getValidationResolutions: (id: number) => api.get<{
    conflicts: Array<{
      bib: number;
      leaderName: string;
      followerName: string;
      style: string | undefined;
      conflictType: 'per-style' | 'cross-style';
      entries: Array<{ eventId: number; eventName: string; level: string; style: string | undefined; inRange: boolean }>;
      currentRange: string;
      allowedRange: string[];
      entryActions: Array<{
        eventId: number;
        eventName: string;
        currentLevel: string;
        style: string | undefined;
        validTargetLevels: string[];
        defaultTargetLevel: string;
      }>;
    }>;
    count: number;
  }>(`/competitions/${id}/validation-resolutions`),
  applyResolution: (id: number, actions: Array<{ eventId: number; action: 'remove' | 'move'; bib: number; targetLevel?: string }>) =>
    api.post<{ results: Array<{ eventId: number; action: string; success: boolean; error?: string }>; allSuccess: boolean }>(
      `/competitions/${id}/apply-resolution`, { actions }
    ),
  reassignBibs: (id: number) =>
    api.post<{ success: boolean }>(`/competitions/${id}/reassign-bibs`),
};

// Studios API
export const studiosApi = {
  getAll: () => api.get<Studio[]>('/studios'),
  getById: (id: number) => api.get<Studio>(`/studios/${id}`),
  create: (studio: Omit<Studio, 'id'>) => api.post<Studio>('/studios', studio),
  update: (id: number, updates: Partial<Omit<Studio, 'id'>>) =>
    api.put<Studio>(`/studios/${id}`, updates),
  delete: (id: number) => api.delete(`/studios/${id}`),
};

// Organizations API
export const organizationsApi = {
  getAll: () => api.get<Organization[]>('/organizations'),
  getById: (id: number) => api.get<Organization>(`/organizations/${id}`),
  create: (org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Organization>('/organizations', org),
  update: (id: number, updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>>) =>
    api.put<Organization>(`/organizations/${id}`, updates),
  delete: (id: number) => api.delete(`/organizations/${id}`),
};

// People API
export const peopleApi = {
  getAll: (competitionId?: number) => 
    api.get<Person[]>('/people', { params: { competitionId } }),
  getById: (id: number) => api.get<Person>(`/people/${id}`),
  create: (person: Omit<Person, 'id'>) => api.post<Person>('/people', person),
  update: (id: number, updates: Partial<Omit<Person, 'id'>>) =>
    api.patch<Person>(`/people/${id}`, updates),
  reassignBib: (id: number, bib: number) =>
    api.patch<Person>(`/people/${id}/bib`, { bib }),
  merge: (keepId: number, mergeId: number) =>
    api.post<Person>(`/people/${keepId}/merge`, { mergeId }),
  delete: (id: number) => api.delete(`/people/${id}`),
};

// Couples API
export const couplesApi = {
  getAll: (competitionId?: number) =>
    api.get<Couple[]>('/couples', { params: { competitionId } }),
  getById: (id: number) => api.get<Couple>(`/couples/${id}`),
  getByBib: (bib: number) => api.get<Couple>(`/couples/${bib}`),
  getEligibleCategories: (id: number, competitionId: number) =>
    api.get<{ categories: string[]; leaderAge?: number; followerAge?: number }>(`/couples/${id}/eligible-categories`, { params: { competitionId } }),
  getEvents: (id: number) => api.get<Event[]>(`/couples/${id}/events`),
  create: (leaderId: number, followerId: number, competitionId: number) =>
    api.post<Couple>('/couples', { leaderId, followerId, competitionId }),
  update: (id: number, updates: Partial<Pick<Couple, 'billTo'>>) =>
    api.patch<Couple>(`/couples/${id}`, updates),
  delete: (id: number) => api.delete(`/couples/${id}`),
};

// Judges API
export const judgesApi = {
  getAll: (competitionId?: number) =>
    api.get<Judge[]>('/judges', { params: { competitionId } }),
  getById: (id: number) => api.get<Judge>(`/judges/${id}`),
  create: (name: string, competitionId: number, profileId?: number) =>
    api.post<Judge>('/judges', { name, competitionId, profileId }),
  update: (id: number, updates: Partial<Judge>) =>
    api.patch<Judge>(`/judges/${id}`, updates),
  delete: (id: number) => api.delete(`/judges/${id}`),
};

// Judge Profiles API (site admin)
export const judgeProfilesApi = {
  getAll: () => api.get<JudgeProfile[]>('/judge-profiles'),
  getById: (id: number) => api.get<JudgeProfile>(`/judge-profiles/${id}`),
  create: (data: Partial<JudgeProfile>) => api.post<JudgeProfile>('/judge-profiles', data),
  update: (id: number, updates: Partial<JudgeProfile>) => api.patch<JudgeProfile>(`/judge-profiles/${id}`, updates),
  delete: (id: number) => api.delete(`/judge-profiles/${id}`),
};

// Events API
export const eventsApi = {
  getAll: (competitionId?: number) => 
    api.get<Record<number, Event>>('/events', { params: { competitionId } }),
  getById: (id: number) => api.get<Event>(`/events/${id}`),
  create: (
    name: string,
    bibs: number[],
    judgeIds: number[],
    competitionId: number,
    designation?: string,
    syllabusType?: string,
    level?: string,
    style?: string,
    dances?: string[],
    scoringType?: 'standard' | 'proficiency',
    isScholarship?: boolean,
    ageCategory?: string
  ) =>
    api.post<Event>('/events', { name, bibs, judgeIds, competitionId, designation, syllabusType, level, style, dances, scoringType, isScholarship, ageCategory }),
  update: (id: number, updates: Partial<Omit<Event, 'id'>>) =>
    api.patch<Event>(`/events/${id}`, updates),
  delete: (id: number) => api.delete(`/events/${id}`),
  getResults: (id: number, round: string) =>
    api.get<EventResult[]>(`/events/${id}/results/${round}`),
  getDetailedResults: (id: number, round: string) =>
    api.get<DetailedResultsResponse>(`/events/${id}/results/${round}?detail=true`),
  submitScores: (
    id: number,
    round: string,
    scores: Array<{ judgeIndex: number; bib: number; score: number }>
  ) => api.post(`/events/${id}/scores/${round}`, { scores }),
  clearScores: (id: number, round: string) =>
    api.delete(`/events/${id}/scores/${round}`),
  getEntries: (eventId: number) =>
    api.get<Couple[]>(`/events/${eventId}/entries`),
  addEntry: (eventId: number, bib: number) =>
    api.post<Event>(`/events/${eventId}/entries`, { bib }),
  removeEntry: (eventId: number, bib: number) =>
    api.delete<Event>(`/events/${eventId}/entries/${bib}`),
  reorderDances: (competitionId: number) =>
    api.post<{ updated: number }>(`/events/reorder-dances/${competitionId}`),
  register: (data: {
    competitionId: number; bib: number;
    designation?: string; syllabusType?: string; level?: string;
    style?: string; dances?: string[]; scoringType?: string;
    isScholarship?: boolean; ageCategory?: string;
  }) => api.post<{ event: Event; created: boolean }>('/events/register', data),
  bulkRegister: (data: {
    competitionId: number; bib: number;
    entries: Array<{
      designation?: string; syllabusType?: string; level?: string;
      style?: string; dances?: string[]; scoringType?: string;
      isScholarship?: boolean; ageCategory?: string;
    }>;
  }) => api.post<{ results: Array<{ label: string; success: boolean; created?: boolean; eventName?: string; error?: string }> }>('/events/bulk-register', data),
  scratch: (eventId: number, bib: number) =>
    api.post<Event>(`/events/${eventId}/scratch`, { bib }),
  unscratch: (eventId: number, bib: number) =>
    api.delete<Event>(`/events/${eventId}/scratch/${bib}`),
  bulkScoringType: (competitionId: number, rules: Record<string, string>, clearScores?: boolean) =>
    api.post<{ updated: number; warning?: boolean; message?: string }>(`/events/bulk-scoring-type/${competitionId}`, { rules, clearScores }),
  stripSyllabusType: (competitionId: number) =>
    api.post<{ updated: number }>(`/events/strip-syllabus-type/${competitionId}`),
  mergeSyllabusTypeDuplicates: (competitionId: number) =>
    api.post<{ mergedGroups: number; deletedEvents: number; details: Array<{ kept: string; merged: string[]; bibsMoved: number }> }>(`/events/merge-syllabus-duplicates/${competitionId}`),
  deleteEmptyEvents: (competitionId: number, confirm?: boolean) =>
    api.post<{ preview?: boolean; count: number; deleted?: number; events: Array<{ id: number; name: string }> }>(`/events/delete-empty/${competitionId}`, { confirm }),
  diagnoseEmpty: (competitionId: number) =>
    api.get<{
      totalEvents: number;
      emptyEventCount: number;
      totalCouples: number;
      couplesWithNoEvents: Array<{ bib: number; leaderId: number; followerId: number }>;
      emptyEventAnalysis: Array<{
        emptyEvent: { id: number; name: string; ageCategory?: string; designation?: string; level?: string; style?: string; dances?: string[] };
        similarEvents: Array<{ id: number; name: string; ageCategory?: string; coupleCount: number }>;
      }>;
    }>(`/events/diagnose-empty/${competitionId}`),
  getSectionResults: (competitionId: number, sectionGroupId: string) =>
    api.get<{
      sectionGroupId: string;
      eventName: string;
      sectionCount: number;
      results: Array<{
        bib: number;
        leaderName: string;
        followerName: string;
        sectionLetter: string;
        eventId: number;
        scores: number[];
        averageScore: number;
        combinedRank: number;
      }>;
    }>(`/events/section-results/${competitionId}/${sectionGroupId}`),
};

// Schedules API
export const schedulesApi = {
  get: (competitionId: number) =>
    api.get<CompetitionSchedule>(`/schedules/${competitionId}`),
  generate: (competitionId: number, styleOrder?: string[], levelOrder?: string[], judgeSettings?: JudgeSettings, timingSettings?: TimingSettings, danceOrder?: Record<string, string[]>, autoBreaks?: AutoBreaksConfig, deferFinals?: boolean, eventTypeOrder?: string[], levelCombining?: LevelCombiningConfig) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/generate`, { styleOrder, levelOrder, danceOrder, judgeSettings, timingSettings, autoBreaks, deferFinals, eventTypeOrder, levelCombining }),
  updateTiming: (competitionId: number, timingSettings: TimingSettings) =>
    api.patch<CompetitionSchedule>(`/schedules/${competitionId}/timing`, { timingSettings }),
  reorder: (competitionId: number, fromIndex: number, toIndex: number) =>
    api.patch<CompetitionSchedule>(`/schedules/${competitionId}/reorder`, { fromIndex, toIndex }),
  advance: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/advance`),
  back: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/back`),
  advanceDance: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/advance-dance`),
  backDance: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/back-dance`),
  jump: (competitionId: number, heatIndex: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/jump`, { heatIndex }),
  reset: (competitionId: number, heatIndex: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/reset`, { heatIndex }),
  rerun: (competitionId: number, heatIndex: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/rerun`, { heatIndex }),
  suggestPosition: (competitionId: number, eventId: number) =>
    api.get<{ position: number }>(`/schedules/${competitionId}/suggest/${eventId}`),
  insert: (competitionId: number, eventId: number, position: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/insert`, { eventId, position }),
  delete: (competitionId: number) =>
    api.delete(`/schedules/${competitionId}`),
  addBreak: (competitionId: number, label: string, duration?: number, position?: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/break`, { label, duration, position }),
  removeBreak: (competitionId: number, heatIndex: number) =>
    api.delete<CompetitionSchedule>(`/schedules/${competitionId}/break/${heatIndex}`),
  updateHeatEntries: (competitionId: number, heatId: string, entries: HeatEntry[], forceOverride?: boolean) =>
    api.patch<CompetitionSchedule>(`/schedules/${competitionId}/heat/${heatId}/entries`, { entries, forceOverride }),
  splitHeatEntry: (competitionId: number, heatId: string, eventId: number, round: string) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/heat/${heatId}/split`, { eventId, round }),
  splitFloorHeat: (competitionId: number, heatId: string, groupCount: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/heat/${heatId}/split-floor`, { groupCount }),
  unsplitFloorHeat: (competitionId: number, heatId: string) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/heat/${heatId}/unsplit`),
  getBackToBack: (competitionId: number, options?: { level?: 'couple' | 'person'; excludePros?: boolean }) =>
    api.get<{ conflicts: Array<{ personId?: number; personName?: string; bib?: number; leaderName?: string; followerName?: string; heatIndex1: number; heatIndex2: number; heatId1: string; heatId2: string; eventName1: string; eventName2: string }>; count: number; conflictHeatIds: string[] }>(`/schedules/${competitionId}/back-to-back`, {
      params: { level: options?.level, excludePros: options?.excludePros },
    }),
  minimizeBackToBack: (competitionId: number) =>
    api.post<{ schedule: CompetitionSchedule; conflictsRemaining: number }>(`/schedules/${competitionId}/minimize-back-to-back`),
  analyze: (competitionId: number) =>
    api.get<{
      estimatedDurationMinutes: number;
      availableMinutes: number | null;
      overflowMinutes: number;
      fitsInWindow: boolean;
      suggestions: Array<{
        type: 'merge' | 'increase-max-couples';
        description: string;
        details: { sourceIndex?: number; targetIndex?: number; newMaxCouples?: number };
        estimatedTimeSavingMinutes: number;
      }>;
    }>(`/schedules/${competitionId}/analyze`),
  optimize: (competitionId: number, suggestions: number[]) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/optimize`, { suggestions }),
  getConsolidationPreview: (competitionId: number) =>
    api.get<{
      currentHeats: number;
      currentDurationMinutes: number;
      availableMinutes: number | null;
      overflowMinutes: number;
      strategies: Array<{
        id: string;
        name: string;
        description: string;
        category: 'couples' | 'levels' | 'timing' | 'combined';
        changes: {
          maxCouplesPerHeat?: number;
          levelCombining?: LevelCombiningConfig;
          defaultDanceDurationSeconds?: number;
          scholarshipDurationSeconds?: number;
          betweenHeatSeconds?: number;
          betweenDanceSeconds?: number;
        };
        totalHeats: number;
        estimatedDurationMinutes: number;
        timeSavedMinutes: number;
        fitsInWindow: boolean;
      }>;
    }>(`/schedules/${competitionId}/consolidation-preview`),
  simulateCombined: (competitionId: number, strategyIds: string[]) =>
    api.post<{
      totalHeats: number;
      estimatedDurationMinutes: number;
      timeSavedMinutes: number;
      fitsInWindow: boolean;
      mergedChanges: {
        maxCouplesPerHeat?: number;
        levelCombining?: LevelCombiningConfig;
        defaultDanceDurationSeconds?: number;
        scholarshipDurationSeconds?: number;
        betweenHeatSeconds?: number;
        betweenDanceSeconds?: number;
      };
    }>(`/schedules/${competitionId}/consolidation-simulate`, { strategyIds }),
  getJudgeSchedule: (competitionId: number) =>
    api.get<{ entries: JudgeScheduleEntry[]; maxMinutesWithoutBreak: number }>(
      `/schedules/${competitionId}/judge-schedule`),
  updateHeatJudges: (competitionId: number, heatId: string, judgeIds: number[]) =>
    api.patch<Record<number, Event>>(`/schedules/${competitionId}/heat/${heatId}/judges`, { judgeIds }),
  generateVariants: (competitionId: number, judgeSettings?: JudgeSettings, timingSettings?: TimingSettings) =>
    api.post<{ variants: ScheduleVariant[] }>(`/schedules/${competitionId}/generate-variants`, { judgeSettings, timingSettings }),
  applyVariant: (competitionId: number, variantId: string) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/apply-variant`, { variantId }),
  // Heat sheet PDFs
  downloadHeatSheetPDF: (competitionId: number, personId: number) =>
    api.get(`/schedules/${competitionId}/heatsheet/pdf/${personId}`, { responseType: 'blob' }),
  downloadAllHeatSheetsPDF: (competitionId: number) =>
    api.get(`/schedules/${competitionId}/heatsheet/pdf`, { responseType: 'blob' }),
  emailHeatSheet: (competitionId: number, personId: number) =>
    api.post<{ success: boolean; sentTo: string }>(`/schedules/${competitionId}/heatsheet/email/${personId}`),
  // Results PDFs
  downloadResultsPDF: (competitionId: number, personId: number) =>
    api.get(`/schedules/${competitionId}/results/pdf/${personId}`, { responseType: 'blob' }),
  downloadAllResultsPDF: (competitionId: number) =>
    api.get(`/schedules/${competitionId}/results/pdf`, { responseType: 'blob' }),
  emailResults: (competitionId: number, personId: number) =>
    api.post<{ success: boolean; sentTo: string }>(`/schedules/${competitionId}/results/email/${personId}`),
};

// Judging API (non-admin, for judges and SSE)
export const judgingApi = {
  getActiveHeat: (competitionId: number) =>
    api.get<ActiveHeatInfo>(`/judging/competition/${competitionId}/active-heat`),
  getScoringProgress: (competitionId: number) =>
    api.get<ScoringProgress>(`/judging/competition/${competitionId}/scoring-progress`),
  submitJudgeScores: (
    competitionId: number,
    judgeId: number,
    eventId: number,
    round: string,
    scores: Array<{ bib: number; score: number }>,
    dance?: string,
  ) => api.post(`/judging/competition/${competitionId}/submit-scores`, {
    judgeId, eventId, round, scores, dance,
  }),
  getJudges: (competitionId: number) =>
    api.get<Judge[]>(`/judging/competition/${competitionId}/judges`),
  getSchedule: (competitionId: number) =>
    api.get<CompetitionSchedule>(`/judging/competition/${competitionId}/schedule`),
  getEvents: (competitionId: number) =>
    api.get<Record<number, Event>>(`/judging/competition/${competitionId}/events`),
  getCouples: (competitionId: number) =>
    api.get<Couple[]>(`/judging/competition/${competitionId}/couples`),
  getCompetition: (competitionId: number) =>
    api.get<Competition>(`/judging/competition/${competitionId}/competition`),
};

// Participant API (non-admin, for self-service registration)
export const participantApi = {
  getCompetitions: () => api.get<Competition[]>('/participant/competitions'),
  getCompetition: (id: number) => api.get<Competition>(`/participant/competitions/${id}`),
  getAgeCategories: (competitionId: number) =>
    api.get<AgeCategory[]>(`/participant/competitions/${competitionId}/age-categories`),
  getProfile: () => api.get<Person[]>('/participant/profile'),
  register: (competitionId: number, data: { name: string; email?: string; role: string; status?: string; level?: string }) =>
    api.post<Person>(`/participant/competitions/${competitionId}/register`, data),
  addPartner: (competitionId: number, data: { name: string; role: string; status?: string; level?: string }) =>
    api.post<{ partner: Person; couple: Couple }>(`/participant/competitions/${competitionId}/partner`, data),
  getMyEntries: (competitionId: number) =>
    api.get<{
      person: Person | null;
      couples: Couple[];
      entries: Event[];
      schedule: Array<{ heatId: string; estimatedStartTime?: string; eventId: number; eventName: string; round: string }>;
    }>(`/participant/competitions/${competitionId}/my-entries`),
  registerEntry: (competitionId: number, data: {
    bib: number; designation?: string; syllabusType?: string; level?: string;
    style?: string; dances?: string[]; scoringType?: string;
    ageCategory?: string;
  }) => api.post<{ event?: Event; created?: boolean; pending?: boolean; message?: string; pendingEntry?: unknown }>(`/participant/competitions/${competitionId}/entries`, data),
  removeEntry: (competitionId: number, eventId: number, bib: number) =>
    api.delete(`/participant/competitions/${competitionId}/entries/${eventId}/${bib}`),
  getAllowedLevels: (competitionId: number, bib: number) =>
    api.get<{
      validationEnabled: boolean;
      allowedLevels: string[];
      coupleLevel: string | null;
      allLevels: string[];
    }>(`/participant/competitions/${competitionId}/allowed-levels/${bib}`),
  getPersonHeatlists: (competitionId: number, personId: number) =>
    api.get<PersonHeatListResponse>(`/participant/competitions/${competitionId}/people/${personId}/heatlists`),
  getPendingEntries: (competitionId: number, bib: number) =>
    api.get<{ pendingEntries: PendingEntry[] }>(`/participant/competitions/${competitionId}/pending-entries/${bib}`),
};

// Scrutineer API (admin-only, schedule-free scoring for paper judging)
export const scrutineerApi = {
  getJudgeScores: (eventId: number, round: string) =>
    api.get<{
      eventId: number; round: string; bibs: number[];
      judges: Array<{ id: number; name: string; judgeNumber: number; isChairman?: boolean }>;
      isRecallRound: boolean; scoringType: 'standard' | 'proficiency';
      dances: string[];
      scoresByBib: Record<number, Record<number, number>>;
      danceScoresByBib?: Record<string, Record<number, Record<number, number>>>;
    }>(`/scrutineer/events/${eventId}/rounds/${round}/judge-scores`),
  submitJudgeScores: (
    eventId: number, round: string, judgeId: number,
    scores: Array<{ bib: number; score: number }>, dance?: string,
  ) => api.post(`/scrutineer/events/${eventId}/rounds/${round}/submit-scores`, { judgeId, scores, dance }),
  compileScores: (eventId: number, round: string) =>
    api.post<{ success: boolean; results: EventResult[] }>(
      `/scrutineer/events/${eventId}/rounds/${round}/compile`
    ),
};

// Users API
export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getMe: () => api.get<User>('/users/me'),
  updateProfile: (updates: UserProfileUpdate) =>
    api.patch<User>('/users/me', updates),
  updateAdmin: (uid: string, isAdmin: boolean) =>
    api.patch<User>(`/users/${uid}/admin`, { isAdmin }),
  getAdminCompetitions: () =>
    api.get<{ competitionIds: number[]; isCompetitionAdmin: boolean; roles?: Record<number, string> }>('/users/me/admin-competitions'),
};

// Invoices API
export const invoicesApi = {
  getSummary: (competitionId: number) =>
    api.get<InvoiceSummary>(`/invoices/${competitionId}`),
  updatePayment: (
    competitionId: number,
    entries: Array<{ eventId: number; bib: number }>,
    paid: boolean,
    paidBy?: number,
    notes?: string
  ) => api.patch<Record<string, EntryPayment>>(`/invoices/${competitionId}/payments`, { entries, paid, paidBy, notes }),
  downloadPDF: (competitionId: number, personId: number) =>
    api.get(`/invoices/${competitionId}/pdf/${personId}`, { responseType: 'blob' }),
  emailInvoice: (competitionId: number, personId: number) =>
    api.post<{ success: boolean; sentTo: string }>(`/invoices/${competitionId}/email/${personId}`),
};

// MindBody API
export const mindbodyApi = {
  connect: (studioId: number, siteId: string, username: string, password: string) =>
    api.post<{ connected: boolean; siteId: string }>(`/mindbody/studios/${studioId}/connect`, { siteId, username, password }),
  disconnect: (studioId: number) =>
    api.delete<{ disconnected: boolean }>(`/mindbody/studios/${studioId}/disconnect`),
  getClients: (studioId: number, params?: { searchText?: string; limit?: number; offset?: number }) =>
    api.get<{ clients: MindbodyClient[]; total: number }>(`/mindbody/studios/${studioId}/clients`, { params }),
  importClients: (studioId: number, competitionId: number, clients: Array<{ id: string; firstName: string; lastName: string; email?: string; role: string; status: string }>) =>
    api.post<{ imported: number; people: Person[] }>(`/mindbody/studios/${studioId}/import`, { competitionId, clients }),
};

// Database API (admin only)
export const databaseApi = {
  seed: () => api.post<{ success: boolean; message: string }>('/database/seed'),
  seedFinished: () => api.post<{ success: boolean; message: string }>('/database/seed-finished'),
  seedValidation: () => api.post<{ success: boolean; message: string }>('/database/seed-validation'),
  getStagingBypass: () => api.get<{ enabled: boolean; allowed: boolean }>('/database/staging-bypass'),
  setStagingBypass: (enabled: boolean) => api.post<{ enabled: boolean; allowed: boolean }>('/database/staging-bypass', { enabled }),
  downloadBackup: () => api.get('/database/backup', { responseType: 'blob' }),
  restoreBackup: (file: File) => {
    const form = new FormData();
    form.append('backup', file);
    return api.post<{ success: boolean; message: string; competitionsRestored: number; usersRestored: number }>(
      '/database/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};

// Settings API (site admin only)
export const settingsApi = {
  get: () => api.get<SiteSettings>('/settings'),
  update: (updates: Partial<SiteSettings>) => api.patch<SiteSettings>('/settings', updates),
};

// Public API client (no auth token)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Public API (no authentication required)
export const publicCompetitionsApi = {
  getAll: (scope?: 'upcoming' | 'recent') =>
    publicApi.get<PublicCompetition[]>('/public/competitions', { params: { scope } }),
  getById: (id: number) =>
    publicApi.get<PublicCompetition>(`/public/competitions/${id}`),
  getEvents: (id: number) =>
    publicApi.get<PublicEvent[]>(`/public/competitions/${id}/events`),
  getPeople: (id: number) =>
    publicApi.get<Array<{ id: number; firstName: string; lastName: string; partnerships: Array<{ bib: number; partnerName: string }> }>>(`/public/competitions/${id}/people`),
  getHeats: (id: number) =>
    publicApi.get<PublicEventWithHeats[]>(`/public/competitions/${id}/heats`),
  getEventResults: (competitionId: number, eventId: number, round: string) =>
    publicApi.get<EventResult[]>(`/public/competitions/${competitionId}/events/${eventId}/results/${round}`),
  getDetailedEventResults: (competitionId: number, eventId: number, round: string) =>
    publicApi.get<DetailedResultsResponse>(`/public/competitions/${competitionId}/events/${eventId}/results/${round}?detail=true`),
  searchByDancer: (competitionId: number, dancerName: string) =>
    publicApi.get<PublicEventSearchResult[]>(`/public/competitions/${competitionId}/search`, { params: { dancerName } }),
  getPersonResults: (competitionId: number, personId: number) =>
    publicApi.get<PersonResultsResponse>(`/public/competitions/${competitionId}/people/${personId}/results`),
  getPersonHeatlists: (competitionId: number, personId: number) =>
    publicApi.get<PersonHeatListResponse>(`/public/competitions/${competitionId}/people/${personId}/heatlists`),
};

export default api;
