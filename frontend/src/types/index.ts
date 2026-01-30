export type CompetitionType = 'NDCA' | 'USA_DANCE' | 'UNAFFILIATED' | 'STUDIO';

export interface Studio {
  id: number;
  name: string;
  location?: string;
  contactInfo?: string;
}

export interface JudgeSettings {
  defaultCount: number;
  levelOverrides: Record<string, number>;
}

export interface Competition {
  id: number;
  name: string;
  type: CompetitionType;
  date: string;
  location?: string;
  studioId?: number;
  description?: string;
  judgeSettings?: JudgeSettings;
  createdAt: string;
}

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'leader' | 'follower' | 'both';
  status: 'student' | 'professional';
  competitionId: number;
  studioId?: number;
}

export interface Couple {
  bib: number;
  leaderId: number;
  followerId: number;
  leaderName: string;
  followerName: string;
  competitionId: number;
}

export interface Judge {
  id: number;
  name: string;
  judgeNumber: number;
  competitionId: number;
}

export interface Heat {
  round: string;
  bibs: number[];
  judges: number[];
}

export interface Event {
  id: number;
  name: string;
  designation?: string;
  syllabusType?: string;
  level?: string;
  style?: string;
  dances?: string[];
  heats: Heat[];
  competitionId: number;
}

export interface EventResult {
  bib: number;
  leaderName: string;
  followerName: string;
  totalRank?: number;
  totalMarks?: number;
  scores: number[];
  isRecall: boolean;
}

export type EventRunStatus = 'pending' | 'announced' | 'scoring' | 'completed';

export interface ScheduledHeat {
  eventId: number;
  round: string;
}

export interface CompetitionSchedule {
  competitionId: number;
  heatOrder: ScheduledHeat[];
  styleOrder: string[];
  levelOrder: string[];
  currentHeatIndex: number;
  heatStatuses: Record<string, EventRunStatus>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string;
}
