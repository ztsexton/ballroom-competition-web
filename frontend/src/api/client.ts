import axios from 'axios';
import { Person, Couple, Judge, Event, EventResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// People API
export const peopleApi = {
  getAll: () => api.get<Person[]>('/people'),
  getById: (id: number) => api.get<Person>(`/people/${id}`),
  create: (person: Omit<Person, 'id'>) => api.post<Person>('/people', person),
  update: (id: number, updates: Partial<Omit<Person, 'id'>>) =>
    api.patch<Person>(`/people/${id}`, updates),
  delete: (id: number) => api.delete(`/people/${id}`),
};

// Couples API
export const couplesApi = {
  getAll: () => api.get<Couple[]>('/couples'),
  getByBib: (bib: number) => api.get<Couple>(`/couples/${bib}`),
  create: (leaderId: number, followerId: number) =>
    api.post<Couple>('/couples', { leaderId, followerId }),
  delete: (bib: number) => api.delete(`/couples/${bib}`),
};

// Judges API
export const judgesApi = {
  getAll: () => api.get<Judge[]>('/judges'),
  getById: (id: number) => api.get<Judge>(`/judges/${id}`),
  create: (name: string) => api.post<Judge>('/judges', { name }),
  delete: (id: number) => api.delete(`/judges/${id}`),
};

// Events API
export const eventsApi = {
  getAll: () => api.get<Record<number, Event>>('/events'),
  getById: (id: number) => api.get<Event>(`/events/${id}`),
  create: (
    name: string, 
    bibs: number[], 
    judgeIds: number[], 
    designation?: string,
    syllabusType?: string,
    level?: string,
    style?: string,
    dances?: string[]
  ) =>
    api.post<Event>('/events', { name, bibs, judgeIds, designation, syllabusType, level, style, dances }),
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

export default api;
