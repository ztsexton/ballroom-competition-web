import { CERTIFICATION_LEVEL_ORDER, DEFAULT_MAX_LEVEL } from '../../constants/levels';

export function isJudgeQualified(
  certifications: Record<string, string[]> | undefined,
  style: string | undefined,
  level: string | undefined,
): boolean {
  if (!level) return true;  // No level = any judge can do it
  const levelIdx = CERTIFICATION_LEVEL_ORDER.indexOf(level);
  const silverIdx = CERTIFICATION_LEVEL_ORDER.indexOf(DEFAULT_MAX_LEVEL);
  if (levelIdx < 0 || levelIdx <= silverIdx) return true;  // Unknown or <= Silver
  if (!certifications || !style) return false;  // Above Silver but no certs
  return certifications[style]?.includes(level) ?? false;
}
