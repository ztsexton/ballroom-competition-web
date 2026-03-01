import { isJudgeQualified } from '../../services/schedule/judgeQualification';

describe('isJudgeQualified', () => {
  it('should return true when no level specified', () => {
    expect(isJudgeQualified(undefined, 'Smooth', undefined)).toBe(true);
  });

  it('should return true for Newcomer level (default allows up to Silver)', () => {
    expect(isJudgeQualified({}, 'Smooth', 'Newcomer')).toBe(true);
  });

  it('should return true for Bronze level', () => {
    expect(isJudgeQualified({}, 'Smooth', 'Bronze')).toBe(true);
  });

  it('should return true for Silver level', () => {
    expect(isJudgeQualified({}, 'Smooth', 'Silver')).toBe(true);
  });

  it('should return false for Gold level without certifications', () => {
    expect(isJudgeQualified({}, 'Smooth', 'Gold')).toBe(false);
  });

  it('should return false for Gold level with undefined certifications', () => {
    expect(isJudgeQualified(undefined, 'Smooth', 'Gold')).toBe(false);
  });

  it('should return true for Gold level with matching certification', () => {
    expect(isJudgeQualified({ Smooth: ['Gold'] }, 'Smooth', 'Gold')).toBe(true);
  });

  it('should return false for Gold in wrong style', () => {
    expect(isJudgeQualified({ Latin: ['Gold'] }, 'Smooth', 'Gold')).toBe(false);
  });

  it('should return true for Championship level with matching certification', () => {
    expect(isJudgeQualified({ Smooth: ['Gold', 'Novice', 'Championship'] }, 'Smooth', 'Championship')).toBe(true);
  });

  it('should return false for Championship level with only Gold certification', () => {
    expect(isJudgeQualified({ Smooth: ['Gold'] }, 'Smooth', 'Championship')).toBe(false);
  });

  it('should return true for unknown level (not in CERTIFICATION_LEVEL_ORDER)', () => {
    expect(isJudgeQualified({}, 'Smooth', 'Open')).toBe(true);
  });

  it('should return false when style is undefined and level is above Silver', () => {
    expect(isJudgeQualified({ Smooth: ['Gold'] }, undefined, 'Gold')).toBe(false);
  });

  it('should handle multiple styles correctly', () => {
    const certs = { Smooth: ['Gold', 'Novice'], Latin: ['Gold'] };
    expect(isJudgeQualified(certs, 'Smooth', 'Novice')).toBe(true);
    expect(isJudgeQualified(certs, 'Latin', 'Novice')).toBe(false);
    expect(isJudgeQualified(certs, 'Latin', 'Gold')).toBe(true);
  });

  it('should return true for Pre-Championship with explicit certification', () => {
    expect(isJudgeQualified({ Standard: ['Pre-Championship'] }, 'Standard', 'Pre-Championship')).toBe(true);
  });
});
