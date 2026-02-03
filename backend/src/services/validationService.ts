import { dataService } from './dataService';
import { AgeCategory, Person, Competition } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Calculate age as of a reference date (competition date).
 */
function calculateAge(dateOfBirth: string, referenceDate: string): number {
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
      }

      // Check both dancers' ages against the category
      const category = org.settings.ageCategories.find(c => c.name === eventAttributes.ageCategory);
      if (category) {
        const [leader, follower] = await Promise.all([
          dataService.getPersonById(couple.leaderId),
          dataService.getPersonById(couple.followerId),
        ]);

        for (const person of [leader, follower]) {
          if (person?.dateOfBirth) {
            const age = calculateAge(person.dateOfBirth, competition.date);
            if (!fitsAgeCategory(age, category)) {
              errors.push(
                `${person.firstName} ${person.lastName} (age ${age}) does not qualify for "${eventAttributes.ageCategory}"`
              );
            }
          }
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
