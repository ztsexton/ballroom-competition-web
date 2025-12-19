export interface Person {
  id: number;
  name: string;
  role: 'leader' | 'follower' | 'both';
  status: 'student' | 'professional';
}

export interface Couple {
  bib: number;
  leaderId: number;
  followerId: number;
  leaderName: string;
  followerName: string;
}

export interface Judge {
  id: number;
  name: string;
  judgeNumber: number;
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
}

export interface Score {
  eventId: number;
  round: string;
  bib: number;
  scores: number[];
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

export interface AppData {
  people: Person[];
  couples: Couple[];
  judges: Judge[];
  events: Record<number, Event>;
  scores: Record<string, number[]>;
  nextPersonId: number;
  nextBib: number;
  nextJudgeId: number;
  nextEventId: number;
}
