export type CompetitionType = 'NDCA' | 'USA_DANCE' | 'UNAFFILIATED' | 'STUDIO';

export interface Studio {
  id: number;
  name: string;
  location?: string;
  contactInfo?: string;
  mindbodySiteId?: string;
  mindbodyToken?: string;
}

export interface MindbodyClient {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  creationDate?: string;
  lastActivityDate?: string;
}

export interface JudgeSettings {
  defaultCount: number;
  levelOverrides: Record<string, number>;
}

export interface PricingTier {
  minEntries: number;
  pricePerEntry: number;
}

export interface MultiDancePricing {
  mode: 'flat' | 'per-dance-count';
  flatTiers?: PricingTier[];
  perDanceCountTiers?: Record<string, PricingTier[]>;
}

export interface CompetitionPricing {
  singleDance: PricingTier[];
  multiDance: MultiDancePricing;
  scholarship: PricingTier[];
}

export interface EntryPayment {
  paid: boolean;
  paidBy?: number;
  paidAt?: string;
  notes?: string;
}

export interface Competition {
  id: number;
  name: string;
  type: CompetitionType;
  date: string;
  location?: string;
  studioId?: number; // Only for STUDIO type competitions
  description?: string;
  judgeSettings?: JudgeSettings;
  defaultScoringType?: 'standard' | 'proficiency';
  levels?: string[];
  pricing?: CompetitionPricing;
  entryPayments?: Record<string, EntryPayment>;
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
  studioId?: number; // For studio competitions
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
  scoringType?: 'standard' | 'proficiency';
  isScholarship?: boolean;
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
  totalScore?: number;
  scores: number[];
  isRecall: boolean;
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

export type EventRunStatus = 'pending' | 'scoring' | 'completed';

export interface ScheduledHeat {
  eventId: number;
  round: string;
  isBreak?: boolean;
  breakLabel?: string;
  breakDuration?: number;
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

export interface ActiveHeatInfo {
  competitionId: number;
  eventId: number;
  eventName: string;
  round: string;
  status: EventRunStatus;
  couples: Array<{ bib: number; leaderName: string; followerName: string }>;
  judges: Array<{ id: number; name: string; judgeNumber: number }>;
  isRecallRound: boolean;
  scoringType?: 'standard' | 'proficiency';
  style?: string;
  level?: string;
  dances?: string[];
  isBreak?: boolean;
  breakLabel?: string;
  breakDuration?: number;
  heatNumber: number;
  totalHeats: number;
}

export interface ScoringProgress {
  eventId: number;
  round: string;
  judges: Array<{
    judgeId: number;
    judgeName: string;
    judgeNumber: number;
    hasSubmitted: boolean;
  }>;
  submittedCount: number;
  totalJudges: number;
  scoresByBib: Record<number, Record<number, number>>;
}

export interface InvoiceLineItem {
  eventId: number;
  eventName: string;
  category: 'single' | 'multi' | 'scholarship';
  danceCount: number;
  pricePerEntry: number;
  bib: number;
  partnerName: string;
  paid: boolean;
}

export interface PartnershipGroup {
  bib: number;
  partnerId: number;
  partnerName: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  paidAmount: number;
}

export interface PersonInvoice {
  personId: number;
  personName: string;
  personStatus: 'student' | 'professional';
  partnerships: PartnershipGroup[];
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface InvoiceSummary {
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  invoices: PersonInvoice[];
}

export interface AppData {
  competitions: Competition[];
  studios: Studio[];
  people: Person[];
  couples: Couple[];
  judges: Judge[];
  events: Record<number, Event>;
  scores: Record<string, number[]>;
  judgeScores: Record<string, Record<number, number>>;
  users: User[];
  schedules: Record<number, CompetitionSchedule>;
  nextCompetitionId: number;
  nextStudioId: number;
  nextPersonId: number;
  nextBib: number;
  nextJudgeId: number;
  nextEventId: number;
}
