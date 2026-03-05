import { Router, Response } from 'express';
import multer from 'multer';
import { AuthRequest, requireAnyAdmin, assertCompetitionAccess } from '../middleware/auth';
import { parseExcelFile, RawImportEntry } from '../services/excelImportService';
import { dataService } from '../services/dataService';
import { DEFAULT_DANCE_ORDER } from '../constants/dances';
import logger from '../utils/logger';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.endsWith('.xlsx')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
});

interface CommitOptions {
  levelMapping?: Record<string, string>;
  studioMapping?: Record<string, string>;
  excludeRows?: number[];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const lastSpaceIdx = trimmed.lastIndexOf(' ');
  if (lastSpaceIdx === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.substring(0, lastSpaceIdx),
    lastName: trimmed.substring(lastSpaceIdx + 1),
  };
}

// Preview an import file
router.post('/:id/import/preview', requireAnyAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const preview = parseExcelFile(req.file.buffer);
    res.json(preview);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to parse import file');
    const message = error instanceof Error ? error.message : 'Failed to parse file';
    res.status(400).json({ error: message });
  }
});

// Commit an import
router.post('/:id/import/commit', requireAnyAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const competitionId = parseInt(req.params.id);
    if (!(await assertCompetitionAccess(req, res, competitionId))) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Options come as a JSON string in the 'options' field of the FormData
    let options: CommitOptions = {};
    if (req.body.options) {
      try {
        options = JSON.parse(req.body.options);
      } catch {
        return res.status(400).json({ error: 'Invalid options JSON' });
      }
    }

    const preview = parseExcelFile(req.file.buffer);
    let entries = preview.entries;

    // Filter out excluded rows
    if (options.excludeRows && options.excludeRows.length > 0) {
      const excludeSet = new Set(options.excludeRows);
      entries = entries.filter(e => !excludeSet.has(e.rowIndex));
    }

    // Apply level mapping
    if (options.levelMapping) {
      for (const entry of entries) {
        if (entry.level && options.levelMapping[entry.level]) {
          entry.level = options.levelMapping[entry.level];
        }
      }
    }

    // Apply studio mapping
    if (options.studioMapping) {
      for (const entry of entries) {
        if (entry.studioName && options.studioMapping[entry.studioName]) {
          entry.studioName = options.studioMapping[entry.studioName];
        }
      }
    }

    const warnings: string[] = [];

    // 1. Create studios
    const existingStudios = await dataService.getStudios();
    const studioNameToId = new Map<string, number>();
    for (const s of existingStudios) {
      studioNameToId.set(s.name.toLowerCase(), s.id);
    }

    const uniqueStudioNames = new Set<string>();
    for (const entry of entries) {
      if (entry.studioName) uniqueStudioNames.add(entry.studioName);
    }

    let studiosCreated = 0;
    for (const studioName of uniqueStudioNames) {
      if (!studioNameToId.has(studioName.toLowerCase())) {
        const newStudio = await dataService.addStudio({ name: studioName });
        studioNameToId.set(studioName.toLowerCase(), newStudio.id);
        studiosCreated++;
      }
    }

    // 2. Create people (deduplicate teachers by name, students by name+studio)
    const teacherNameToId = new Map<string, number>();
    const studentKeyToId = new Map<string, number>();
    let peopleCreated = 0;

    for (const entry of entries) {
      const studioId = entry.studioName ? studioNameToId.get(entry.studioName.toLowerCase()) : undefined;
      const isAmateur = entry.partnership === 'amateur';

      // Teacher (leader for Pro/Am, 'both' for Amateur)
      if (entry.teacherName) {
        const teacherKey = entry.teacherName.toLowerCase();
        if (!teacherNameToId.has(teacherKey)) {
          const { firstName, lastName } = splitName(entry.teacherName);
          const person = await dataService.addPerson({
            firstName,
            lastName,
            role: isAmateur ? 'both' : 'leader',
            status: isAmateur ? 'student' : 'professional',
            competitionId,
            studioId,
          });
          teacherNameToId.set(teacherKey, person.id);
          peopleCreated++;
        }
      }

      // Student (follower for Pro/Am, 'both' for Amateur)
      if (entry.studentName) {
        const studentStudioKey = `${entry.studentName.toLowerCase()}|${(entry.studioName || '').toLowerCase()}`;
        if (!studentKeyToId.has(studentStudioKey)) {
          const { firstName, lastName } = splitName(entry.studentName);
          const person = await dataService.addPerson({
            firstName,
            lastName,
            role: isAmateur ? 'both' : 'follower',
            status: 'student',
            level: entry.level || undefined,
            ageCategory: entry.ageCategory || undefined,
            competitionId,
            studioId,
          });
          studentKeyToId.set(studentStudioKey, person.id);
          peopleCreated++;
        }
      }
    }

    // 3. Create couples
    const coupleKeyToBib = new Map<string, number>();
    let couplesCreated = 0;

    for (const entry of entries) {
      if (!entry.studentName || !entry.teacherName) continue;

      const coupleKey = `${entry.studentName.toLowerCase()}|${entry.teacherName.toLowerCase()}`;
      if (!coupleKeyToBib.has(coupleKey)) {
        const studentStudioKey = `${entry.studentName.toLowerCase()}|${(entry.studioName || '').toLowerCase()}`;
        const studentId = studentKeyToId.get(studentStudioKey);
        const teacherId = teacherNameToId.get(entry.teacherName.toLowerCase());

        if (!studentId || !teacherId) {
          warnings.push(`Could not find person records for couple: "${entry.studentName}" / "${entry.teacherName}"`);
          continue;
        }

        const isAmateur = entry.partnership === 'amateur';
        const leaderId = isAmateur ? studentId : teacherId;
        const followerId = isAmateur ? teacherId : studentId;

        const couple = await dataService.addCouple(leaderId, followerId, competitionId);
        if (couple) {
          coupleKeyToBib.set(coupleKey, couple.bib);
          couplesCreated++;
        } else {
          warnings.push(`Failed to create couple for "${entry.studentName}" / "${entry.teacherName}"`);
        }
      }
    }

    // 4. Create events by grouping entries
    interface EventGroup {
      bibs: Set<number>;
      designation: string;
      level: string;
      ageCategory: string;
      style: string;
      dances: string[];
      scoringType: 'standard' | 'proficiency';
      isScholarship: boolean;
      name: string;
    }

    const eventGroups = new Map<string, EventGroup>();

    for (const entry of entries) {
      if (!entry.studentName || !entry.teacherName) continue;

      const coupleKey = `${entry.studentName.toLowerCase()}|${entry.teacherName.toLowerCase()}`;
      const bib = coupleKeyToBib.get(coupleKey);
      if (!bib) continue;

      const designation = entry.partnership === 'amateur' ? 'Amateur' : 'Pro/Am';
      const level = entry.level || '';
      const ageCategory = entry.ageCategory || '';

      // Single dance events
      for (const { dance, style } of entry.singleDances) {
        const eventKey = `single|${level}|${ageCategory}|${style}|${dance}`;
        if (!eventGroups.has(eventKey)) {
          eventGroups.set(eventKey, {
            bibs: new Set([bib]),
            designation,
            level,
            ageCategory,
            style,
            dances: [dance],
            scoringType: 'standard',
            isScholarship: false,
            name: [ageCategory, level, style, dance].filter(Boolean).join(' '),
          });
        } else {
          eventGroups.get(eventKey)!.bibs.add(bib);
        }
      }

      // Multi-dance events
      for (const styleLabel of entry.multiDanceStyles) {
        const eventKey = `multi|${level}|${ageCategory}|${styleLabel}`;
        if (!eventGroups.has(eventKey)) {
          const dances = DEFAULT_DANCE_ORDER[styleLabel] || [];
          eventGroups.set(eventKey, {
            bibs: new Set([bib]),
            designation,
            level,
            ageCategory,
            style: styleLabel,
            dances,
            scoringType: 'standard',
            isScholarship: false,
            name: [ageCategory, level, styleLabel].filter(Boolean).join(' '),
          });
        } else {
          eventGroups.get(eventKey)!.bibs.add(bib);
        }
      }

      // Scholarship events
      for (const styleLabel of entry.scholarshipStyles) {
        const eventKey = `scholarship|${level}|${ageCategory}|${styleLabel}`;
        if (!eventGroups.has(eventKey)) {
          const dances = DEFAULT_DANCE_ORDER[styleLabel] || [];
          eventGroups.set(eventKey, {
            bibs: new Set([bib]),
            designation,
            level,
            ageCategory,
            style: styleLabel,
            dances,
            scoringType: 'standard',
            isScholarship: true,
            name: [ageCategory, level, styleLabel, 'Scholarship'].filter(Boolean).join(' '),
          });
        } else {
          eventGroups.get(eventKey)!.bibs.add(bib);
        }
      }

      // Showcase events
      if (entry.showcaseDanceName) {
        const eventKey = `showcase|${bib}|${entry.showcaseDanceName}`;
        if (!eventGroups.has(eventKey)) {
          eventGroups.set(eventKey, {
            bibs: new Set([bib]),
            designation,
            level,
            ageCategory,
            style: '',
            dances: [entry.showcaseDanceName],
            scoringType: 'proficiency',
            isScholarship: false,
            name: `Showcase - ${entry.showcaseDanceName}`,
          });
        }
      }
    }

    let eventsCreated = 0;
    for (const group of eventGroups.values()) {
      await dataService.addEvent(
        group.name,
        Array.from(group.bibs),
        [],
        competitionId,
        group.designation,
        undefined,
        group.level,
        group.style,
        group.dances,
        group.scoringType,
        group.isScholarship,
        group.ageCategory
      );
      eventsCreated++;
    }

    // 5. Update competition with detected levels
    const allLevels = new Set<string>();
    for (const entry of entries) {
      if (entry.level) allLevels.add(entry.level);
    }
    if (allLevels.size > 0) {
      await dataService.updateCompetition(competitionId, {
        levels: Array.from(allLevels),
      });
    }

    res.json({
      studiosCreated,
      peopleCreated,
      couplesCreated,
      eventsCreated,
      warnings,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Failed to commit import');
    const message = error instanceof Error ? error.message : 'Failed to commit import';
    res.status(500).json({ error: message });
  }
});

export default router;
