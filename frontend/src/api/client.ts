import axios from 'axios';
import { Person, Couple, Judge, Event, EventResult, Competition, Studio, User, CompetitionSchedule, JudgeSettings, ActiveHeatInfo, ScoringProgress, InvoiceSummary, EntryPayment, MindbodyClient } from '../types';
import { auth } from '../config/firebase';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Firebase ID token to all requests
api.interceptors.request.use(
  async (config) => {
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
  create: (competition: Omit<Competition, 'id' | 'createdAt'>) => 
    api.post<Competition>('/competitions', competition),
  update: (id: number, updates: Partial<Omit<Competition, 'id' | 'createdAt'>>) =>
    api.put<Competition>(`/competitions/${id}`, updates),
  delete: (id: number) => api.delete(`/competitions/${id}`),
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

// People API
export const peopleApi = {
  getAll: (competitionId?: number) => 
    api.get<Person[]>('/people', { params: { competitionId } }),
  getById: (id: number) => api.get<Person>(`/people/${id}`),
  create: (person: Omit<Person, 'id'>) => api.post<Person>('/people', person),
  update: (id: number, updates: Partial<Omit<Person, 'id'>>) =>
    api.patch<Person>(`/people/${id}`, updates),
  delete: (id: number) => api.delete(`/people/${id}`),
};

// Couples API
export const couplesApi = {
  getAll: (competitionId?: number) => 
    api.get<Couple[]>('/couples', { params: { competitionId } }),
  getByBib: (bib: number) => api.get<Couple>(`/couples/${bib}`),
  create: (leaderId: number, followerId: number, competitionId: number) =>
    api.post<Couple>('/couples', { leaderId, followerId, competitionId }),
  delete: (bib: number) => api.delete(`/couples/${bib}`),
};

// Judges API
export const judgesApi = {
  getAll: (competitionId?: number) => 
    api.get<Judge[]>('/judges', { params: { competitionId } }),
  getById: (id: number) => api.get<Judge>(`/judges/${id}`),
  create: (name: string, competitionId: number) => 
    api.post<Judge>('/judges', { name, competitionId }),
  delete: (id: number) => api.delete(`/judges/${id}`),
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
    isScholarship?: boolean
  ) =>
    api.post<Event>('/events', { name, bibs, judgeIds, competitionId, designation, syllabusType, level, style, dances, scoringType, isScholarship }),
  update: (id: number, updates: Partial<Omit<Event, 'id'>>) =>
    api.patch<Event>(`/events/${id}`, updates),
  delete: (id: number) => api.delete(`/events/${id}`),
  getResults: (id: number, round: string) =>
    api.get<EventResult[]>(`/events/${id}/results/${round}`),
  submitScores: (
    id: number,
    round: string,
    scores: Array<{ judgeIndex: number; bib: number; score: number }>
  ) => api.post(`/events/${id}/scores/${round}`, { scores }),
  clearScores: (id: number, round: string) =>
    api.delete(`/events/${id}/scores/${round}`),
};

// Schedules API
export const schedulesApi = {
  get: (competitionId: number) =>
    api.get<CompetitionSchedule>(`/schedules/${competitionId}`),
  generate: (competitionId: number, styleOrder?: string[], levelOrder?: string[], judgeSettings?: JudgeSettings) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/generate`, { styleOrder, levelOrder, judgeSettings }),
  reorder: (competitionId: number, fromIndex: number, toIndex: number) =>
    api.patch<CompetitionSchedule>(`/schedules/${competitionId}/reorder`, { fromIndex, toIndex }),
  advance: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/advance`),
  back: (competitionId: number) =>
    api.post<CompetitionSchedule>(`/schedules/${competitionId}/back`),
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
  ) => api.post(`/judging/competition/${competitionId}/submit-scores`, {
    judgeId, eventId, round, scores,
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

// Users API
export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getMe: () => api.get<User>('/users/me'),
  updateAdmin: (uid: string, isAdmin: boolean) =>
    api.patch<User>(`/users/${uid}/admin`, { isAdmin }),
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

export default api;
