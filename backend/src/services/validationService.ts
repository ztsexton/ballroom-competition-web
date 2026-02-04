import { dataService } from './dataService';
import { AgeCategory, Person, Competition } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Calculate age as of a reference date (competition date).
 */
export function calculateAge(dateOfBirth: string, referenceDate: string): number {
  const dob = new Date(dateOfBirth);
  const ref = new Date(referenceDate);
  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check if a person's age fits an age category.
 */
function fitsAgeCategory(age: number, category: AgeCategory): boolean {
  if (category.minAge !== undefined && age < category.minAge) return false;
  if (category.maxAge !== undefined && age > category.maxAge) return false;
  return true;
}

/**
 * NDCA Senior pair thresholds.
 * Each entry: [seniorLevel, olderPartnerMin, youngerPartnerMin]
 * "one partner >= X, the other >= Y" where X > Y
 */
const SENIOR_THRESHOLDS: Array<[number, number, number]> = [
  [4, 65, 60],
  [3, 55, 50],
  [2, 45, 40],
  [1, 35, 30],
];

/**
 * Compute eligible NDCA age categories for a couple based on both partners' ages.
 *
 * Rules from age_ranges.md:
 * - Youth/Adult determined by the OLDER partner's age
 * - Senior level determined by pair thresholds (both partners' ages)
 * - Youth can dance up to Adult
 * - Seniors can dance down through lower Senior levels and Adult
 */
export function getNdcaCoupleCategories(olderAge: number, youngerAge: number): string[] {
  const categories: string[] = [];

  // Youth: older partner is 16-18
  if (olderAge >= 16 && olderAge <= 18) {
    categories.push('Youth', 'Adult');
    return categories;
  }

  // Must be at least 16 to compete
  if (olderAge < 16) return [];

  // Adult: older partner is 19+
  categories.push('Adult');

  // Senior thresholds: check from highest (IV) down to lowest (I)
  // max(ages) >= olderThreshold AND min(ages) >= youngerThreshold
  let maxSenior = 0;
  for (const [level, olderMin, youngerMin] of SENIOR_THRESHOLDS) {
    if (olderAge >= olderMin && youngerAge >= youngerMin) {
      maxSenior = level;
      break; // We check from highest first, so first match is the max
    }
  }

  // Add all eligible senior levels (can dance down)
  for (let i = 1; i <= maxSenior; i++) {
    categories.push(`Senior ${i}`);
  }

  return categories;
}

/**
 * Get eligible age categories for a couple given the competition's organization.
 * For NDCA orgs, uses couple-level pair threshold rules.
 * For other orgs, falls back to per-person range checking against org categories.
 */
export async function getCoupleEligibleCategories(
  leaderId: number,
  followerId: number,
  competitionId: number,
): Promise<string[]> {
  const [leader, follower] = await Promise.all([
    dataService.getPersonById(leaderId),
    dataService.getPersonById(followerId),
  ]);
  if (!leader?.dateOfBirth || !follower?.dateOfBirth) return [];

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition || !competition.organizationId) return [];

  const org = await dataService.getOrganizationById(competition.organizationId);
  if (!org || !org.settings.ageCategories || org.settings.ageCategories.length === 0) return [];

  const leaderAge = calculateAge(leader.dateOfBirth, competition.date);
  const followerAge = calculateAge(follower.dateOfBirth, competition.date);

  if (org.rulePresetKey === 'ndca') {
    const olderAge = Math.max(leaderAge, followerAge);
    const youngerAge = Math.min(leaderAge, followerAge);
    const ndcaCategories = getNdcaCoupleCategories(olderAge, youngerAge);
    // Filter to only categories configured on the org
    const orgCategoryNames = org.settings.ageCategories.map(c => c.name);
    return ndcaCategories.filter(c => orgCategoryNames.includes(c));
  }

  // Non-NDCA: both dancers must individually fit the category
  return org.settings.ageCategories
    .filter(cat => fitsAgeCategory(leaderAge, cat) && fitsAgeCategory(followerAge, cat))
    .map(cat => cat.name);
}

/**
 * Get eligible age categories for a person given the competition's organization settings.
 */
export async function getEligibleAgeCategories(
  personId: number,
  competitionId: number,
): Promise<string[]> {
  const person = await dataService.getPersonById(personId);
  if (!person || !person.dateOfBirth) return [];

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition || !competition.organizationId) return [];

  const org = await dataService.getOrganizationById(competition.organizationId);
  if (!org || !org.settings.ageCategories) return [];

  const age = calculateAge(person.dateOfBirth, competition.date);
  return org.settings.ageCategories
    .filter(cat => fitsAgeCategory(age, cat))
    .map(cat => cat.name);
}

/**
 * Validate whether a couple can enter an event with the given attributes.
 */
export async function validateEntry(
  competitionId: number,
  bib: number,
  eventAttributes: {
    level?: string;
    ageCategory?: string;
    designation?: string;
  },
): Promise<ValidationResult> {
  const errors: string[] = [];

  const couple = await dataService.getCoupleByBib(bib);
  if (!couple) {
    return { valid: false, errors: ['Couple not found'] };
  }

  const competition = await dataService.getCompetitionById(competitionId);
  if (!competition) {
    return { valid: false, errors: ['Competition not found'] };
  }

  // Validate level is in competition's configured levels
  if (eventAttributes.level && competition.levels && competition.levels.length > 0) {
    if (!competition.levels.includes(eventAttributes.level)) {
      errors.push(`Level "${eventAttributes.level}" is not available for this competition`);
    }
  }

  // Validate age category if specified
  if (eventAttributes.ageCategory && competition.organizationId) {
    const org = await dataService.getOrganizationById(competition.organizationId);
    if (org?.settings.ageCategories && org.settings.ageCategories.length > 0) {
      const validCategories = org.settings.ageCategories.map(c => c.name);
      if (!validCategories.includes(eventAttributes.ageCategory)) {
        errors.push(`Age category "${eventAttributes.ageCategory}" is not configured for this organization`);
      } else {
        // Use couple-level eligibility check
        const eligible = await getCoupleEligibleCategories(couple.leaderId, couple.followerId, competitionId);
        if (!eligible.includes(eventAttributes.ageCategory)) {
          const [leader, follower] = await Promise.all([
            dataService.getPersonById(couple.leaderId),
            dataService.getPersonById(couple.followerId),
          ]);
          const leaderAge = leader?.dateOfBirth ? calculateAge(leader.dateOfBirth, competition.date) : '?';
          const followerAge = follower?.dateOfBirth ? calculateAge(follower.dateOfBirth, competition.date) : '?';
          const eligibleStr = eligible.length > 0 ? eligible.join(', ') : 'none (date of birth may be missing)';
          errors.push(
            `Couple (ages ${leaderAge}, ${followerAge}) is not eligible for "${eventAttributes.ageCategory}". Eligible categories: ${eligibleStr}`
          );
        }
      }
    }
  }

  // Validate designation vs status (e.g., Pro-Am requires one student + one professional)
  if (eventAttributes.designation === 'Pro-Am') {
    const [leader, follower] = await Promise.all([
      dataService.getPersonById(couple.leaderId),
      dataService.getPersonById(couple.followerId),
    ]);
    if (leader && follower) {
      const statuses = [leader.status, follower.status];
      if (!statuses.includes('student') || !statuses.includes('professional')) {
        errors.push('Pro-Am events require one student and one professional');
      }
    }
  }

  if (eventAttributes.designation === 'Amateur') {
    const [leader, follower] = await Promise.all([
      dataService.getPersonById(couple.leaderId),
      dataService.getPersonById(couple.followerId),
    ]);
    if (leader && follower) {
      if (leader.status !== 'student' || follower.status !== 'student') {
        errors.push('Amateur events require both dancers to be students');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
