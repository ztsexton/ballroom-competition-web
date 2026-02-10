export type CompetitionType = 'NDCA' | 'USA_DANCE' | 'WDC' | 'WDSF' | 'UNAFFILIATED' | 'STUDIO';

export interface Studio {
  id: number;
  name: string;
  location?: string;
  contactInfo?: string;
  mindbodySiteId?: string;
  mindbodyToken?: string;
}

export type RulePresetKey = 'ndca' | 'usadance' | 'wdc' | 'wdsf' | 'custom';

export interface AgeCategory {
  name: string;
  minAge?: number;
  maxAge?: number;
}

export interface OrganizationSettings {
  defaultLevels?: string[];
  defaultScoringType?: 'standard' | 'proficiency';
  defaultMaxCouplesPerHeat?: number;
  ageCategories?: AgeCategory[];
}

export interface Organization {
  id: number;
  name: string;
  rulePresetKey: RulePresetKey;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
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

export interface TimingSettings {
  defaultDanceDurationSeconds: number;
  levelDurationOverrides?: Record<string, number>;
  scholarshipDurationSeconds?: number;
  betweenDanceSeconds: number;
  betweenHeatSeconds: number;
  startTime?: string;
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

export interface RecallRules {
  finalSize?: number;       // Target final round size (default: 6)
  finalMaxSize?: number;    // Hard max final size for tie expansion (default: 8)
  includeTies?: boolean;    // Include full tie group at cut line (default: true)
}

export interface EntryValidation {
  enabled: boolean;
  levelsAboveAllowed: number;  // How many levels above their declared level they can enter
}

export interface Competition {
  id: number;
  name: string;
  type: CompetitionType;
  date: string;
  location?: string;
  studioId?: number; // Only for STUDIO type competitions
  organizationId?: number;
  description?: string;
  judgeSettings?: JudgeSettings;
  timingSettings?: TimingSettings;
  defaultScoringType?: 'standard' | 'proficiency';
  levels?: string[];
  levelMode?: 'combined' | 'integrated'; // combined: separate Open/Syllabus toggle; integrated: Open levels in the list
  pricing?: CompetitionPricing;
  currency?: string;
  entryPayments?: Record<string, EntryPayment>;
  maxCouplesPerHeat?: number;
  maxCouplesOnFloor?: number;
  maxCouplesOnFloorByLevel?: Record<string, number>;
  recallRules?: RecallRules;
  entryValidation?: EntryValidation;
  ageCategories?: AgeCategory[];
  registrationOpen?: boolean;
  registrationOpenAt?: string;  // ISO date string for scheduled open
  publiclyVisible?: boolean;
  publiclyVisibleAt?: string;   // ISO date string for scheduled visibility
  resultsPublic?: boolean;
  heatListsPublished?: boolean;
  heatListsPublishedAt?: string; // ISO date string for scheduled publish
  websiteUrl?: string;
  organizerEmail?: string;
  createdAt: string;
}

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'leader' | 'follower' | 'both';
  status: 'student' | 'professional';
  dateOfBirth?: string;
  ageCategory?: string;
  level?: string;  // Declared skill level for entry validation
  competitionId: number;
  studioId?: number; // For studio competitions
  userId?: string; // Firebase UID linking person to logged-in user
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
  isChairman?: boolean;
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
  ageCategory?: string;
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
  place?: number;
  totalRank?: number;
  totalMarks?: number;
  totalScore?: number;
  scores: number[];
  danceScores?: Array<{ dance: string; placement: number }>;
  isRecall: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  phone?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  studioTeamName?: string;
  signInMethods: string[];
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  studioTeamName?: string;
}

export type EventRunStatus = 'pending' | 'scoring' | 'completed';

export interface HeatEntry {
  eventId: number;
  round: string;
  bibSubset?: number[];
  floorHeatIndex?: number;
  totalFloorHeats?: number;
  dance?: string;
}

export interface ScheduledHeat {
  id: string;
  entries: HeatEntry[];
  isBreak?: boolean;
  breakLabel?: string;
  breakDuration?: number;
  estimatedStartTime?: string;
  actualStartTime?: string;
  estimatedDurationSeconds?: number;
}

export interface CompetitionSchedule {
  competitionId: number;
  heatOrder: ScheduledHeat[];
  styleOrder: string[];
  levelOrder: string[];
  currentHeatIndex: number;
  currentDance?: string;
  heatStatuses: Record<string, EventRunStatus>;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveHeatEntry {
  eventId: number;
  eventName: string;
  round: string;
  couples: Array<{ bib: number; leaderName: string; followerName: string }>;
  isRecallRound: boolean;
  scoringType?: 'standard' | 'proficiency';
  designation?: string;
  style?: string;
  level?: string;
  dances?: string[];
  floorHeatIndex?: number;
  totalFloorHeats?: number;
  recallCount?: number;
}

export interface ActiveHeatInfo {
  competitionId: number;
  heatId: string;
  entries: ActiveHeatEntry[];
  status: EventRunStatus;
  judges: Array<{ id: number; name: string; judgeNumber: number; isChairman?: boolean }>;
  isBreak?: boolean;
  breakLabel?: string;
  breakDuration?: number;
  heatNumber: number;
  totalHeats: number;
  currentDance?: string;
  allDances?: string[];
}

export interface ScoringProgressEntry {
  eventId: number;
  round: string;
  scoresByBib: Record<number, Record<number, number>>;
  dances?: string[];
  danceScoresByBib?: Record<string, Record<number, Record<number, number>>>;
}

export interface ScoringProgress {
  heatId: string;
  entries: ScoringProgressEntry[];
  judges: Array<{
    judgeId: number;
    judgeName: string;
    judgeNumber: number;
    hasSubmitted: boolean;
    isChairman?: boolean;
  }>;
  submittedCount: number;
  totalJudges: number;
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
  organizations: Organization[];
  nextOrganizationId: number;
  nextPersonId: number;
  nextBib: number;
  nextJudgeId: number;
  nextEventId: number;
}
