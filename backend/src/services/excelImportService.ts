import * as XLSX from 'xlsx';

interface DanceColumnMapping {
  colIndex: number;
  dance: string;
  style: string;
  originalName: string;
}

export interface RawImportEntry {
  rowIndex: number;
  level: string;
  ageCategory: string;
  studioName: string;
  studentName: string;
  teacherName: string;
  partnership: 'proam' | 'amateur';
  singleDances: { dance: string; style: string }[];
  multiDanceStyles: string[];
  scholarshipStyles: string[];
  showcaseDanceName?: string;
}

export interface ImportPreview {
  entries: RawImportEntry[];
  detectedAgeCategories: { name: string; minAge?: number; maxAge?: number }[];
  detectedLevels: string[];
  detectedStudios: string[];
  detectedDances: Record<string, string[]>;
  detectedPeople: { name: string; role: 'student' | 'professional'; studio: string }[];
  eventSummary: EventSummaryItem[];
  warnings: string[];
}

export interface EventSummaryItem {
  name: string;
  style: string;
  level: string;
  ageCategory: string;
  dances: string[];
  isMultiDance: boolean;
  isScholarship: boolean;
  coupleCount: number;
  couples: { student: string; teacher: string }[];
}

const DANCE_NAME_MAP: Record<string, string> = {
  'vienesse waltz': 'Viennese Waltz',
  'viennese waltz': 'Viennese Waltz',
  'box rumba': 'Rumba',
  'eastern swing': 'Swing',
  'int rumba': 'Rumba',
  'quick step': 'Quickstep',
  'quickstep': 'Quickstep',
  'hustle/boogie': 'Hustle',
  'western swing': 'West Coast Swing',
  'argentine tango': 'Argentine Tango',
  'boere wals': 'Boere Wals',
  'foxtrot': 'Foxtrot',
  'waltz': 'Waltz',
  'tango': 'Tango',
  'cha cha': 'Cha Cha',
  'mambo': 'Mambo',
  'bolero': 'Bolero',
  'samba': 'Samba',
  'jive': 'Jive',
  'paso doble': 'Paso Doble',
  'merengue': 'Merengue',
  'sokkie': 'Sokkie',
  'bachata': 'Bachata',
  'salsa': 'Salsa',
  'kizomba': 'Kizomba',
  'jazz': 'Jazz',
};

const LEVEL_MAP: Record<string, string> = {
  'champ': 'Championship',
  'rising star': 'Pre-Championship',
};

const BALLROOM_DANCES = new Set([
  'Foxtrot', 'Waltz', 'Tango', 'Viennese Waltz', 'Quickstep',
]);

const LATIN_DANCES = new Set([
  'Cha Cha', 'Rumba', 'Samba', 'Jive', 'Paso Doble',
  'Mambo', 'Bolero', 'Swing',
]);

const MULTI_DANCE_STYLE_MAP: Record<string, string> = {
  'standard ballroom': 'Standard',
  'latin international': 'Latin',
  'smooth ballroom': 'Smooth',
  'rhythm american': 'Rhythm',
};

function normalizeDanceName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return DANCE_NAME_MAP[key] ?? raw.trim();
}

function normalizeLevel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return LEVEL_MAP[key] ?? raw.trim();
}

function normalizePartnership(raw: string): 'proam' | 'amateur' {
  const key = raw.trim().toLowerCase().replace(/\//g, '');
  if (key === 'amateur') return 'amateur';
  return 'proam';
}

function detectStyle(row2Label: string, canonicalDance: string): string {
  const label = row2Label.trim().toLowerCase();

  if (label.includes('speciality') || label.includes('night')) {
    return 'Night Club';
  }

  if (label.startsWith('american')) {
    if (BALLROOM_DANCES.has(canonicalDance)) return 'Smooth';
    if (LATIN_DANCES.has(canonicalDance)) return 'Rhythm';
    return 'Smooth';
  }

  if (label.startsWith('international')) {
    if (BALLROOM_DANCES.has(canonicalDance)) return 'Standard';
    if (LATIN_DANCES.has(canonicalDance)) return 'Latin';
    return 'Standard';
  }

  return 'Unknown';
}

function isCellMarked(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.startsWith('=')) return false;
    return true;
  }
  if (typeof value === 'number') return value > 0;
  return Boolean(value);
}

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[cellAddress];
  return cell ? cell.v : undefined;
}

function getCellString(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const val = getCellValue(sheet, row, col);
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function findLabelRow(sheet: XLSX.WorkSheet, maxRows: number): number {
  for (let r = 0; r < Math.min(maxRows, 10); r++) {
    const col0 = getCellString(sheet, r, 0).toLowerCase();
    const col1 = getCellString(sheet, r, 1).toLowerCase();
    const col2 = getCellString(sheet, r, 2).toLowerCase();
    if (col0.includes('level') && col1.includes('age') && col2.includes('studio')) {
      return r;
    }
  }
  return 2;
}

function buildDanceColumnMappings(
  sheet: XLSX.WorkSheet,
  danceNameRow: number,
  styleRow: number,
  startCol: number,
  endCol: number
): DanceColumnMapping[] {
  const mappings: DanceColumnMapping[] = [];
  let currentStyleLabel = '';

  for (let c = startCol; c <= endCol; c++) {
    const styleCell = getCellString(sheet, styleRow, c);
    if (styleCell) {
      currentStyleLabel = styleCell;
    }

    const danceRaw = getCellString(sheet, danceNameRow, c);
    if (!danceRaw) continue;

    const canonical = normalizeDanceName(danceRaw);
    const style = detectStyle(currentStyleLabel, canonical);

    mappings.push({
      colIndex: c,
      dance: canonical,
      style,
      originalName: danceRaw,
    });
  }

  return mappings;
}

function parseAgeCategories(cellText: string): { name: string; minAge?: number; maxAge?: number }[] {
  const categories: { name: string; minAge?: number; maxAge?: number }[] = [];
  if (!cellText) return categories;

  const patterns = [
    /([A-Za-z][A-Za-z ]*?):\s*[Uu]nder\s+(\d+)/g,
    /([A-Za-z][A-Za-z ]*?)\s+[Oo]ver\s+(\d+)/g,
    /([A-Za-z][A-Za-z ]*?):\s*[Oo]ver\s+(\d+)/g,
  ];

  const seen = new Set<string>();

  // Under patterns
  const underRegex = /([A-Za-z][A-Za-z ]*?):\s*[Uu]nder\s+(\d+)/g;
  let match = underRegex.exec(cellText);
  while (match) {
    const name = match[1].trim();
    if (name.toUpperCase() !== 'AGE GROUPS' && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      categories.push({ name, maxAge: parseInt(match[2], 10) - 1 });
    }
    match = underRegex.exec(cellText);
  }

  // Over patterns (with colon)
  const overColonRegex = /([A-Za-z][A-Za-z ]*?):\s*[Oo]ver\s+(\d+)/g;
  match = overColonRegex.exec(cellText);
  while (match) {
    const name = match[1].trim();
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      categories.push({ name, minAge: parseInt(match[2], 10) });
    }
    match = overColonRegex.exec(cellText);
  }

  // Over patterns (without colon)
  const overRegex = /([A-Za-z][A-Za-z ]+?)\s+[Oo]ver\s+(\d+)/g;
  match = overRegex.exec(cellText);
  while (match) {
    const name = match[1].trim();
    if (name.toUpperCase() !== 'AGE GROUPS' && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      categories.push({ name, minAge: parseInt(match[2], 10) });
    }
    match = overRegex.exec(cellText);
  }

  return categories;
}

function buildMultiDanceLabel(colHeader: string): string {
  const key = colHeader.trim().toLowerCase();
  return MULTI_DANCE_STYLE_MAP[key] ?? colHeader.trim();
}

export function parseExcelFile(buffer: Buffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'entries')
    ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const maxRow = range.e.r;
  const maxCol = range.e.c;

  const labelRow = findLabelRow(sheet, maxRow + 1);
  const danceNameRow = labelRow - 2;
  const styleRow = labelRow - 1;

  // Build single dance column mappings (cols 8-37)
  const singleDanceEnd = Math.min(37, maxCol);
  const singleDanceMappings = buildDanceColumnMappings(sheet, danceNameRow, styleRow, 8, singleDanceEnd);

  // Multi-dance columns (cols 40-43)
  const multiDanceCols: { colIndex: number; label: string }[] = [];
  for (let c = 40; c <= Math.min(43, maxCol); c++) {
    const header = getCellString(sheet, danceNameRow, c);
    if (header) {
      multiDanceCols.push({ colIndex: c, label: buildMultiDanceLabel(header) });
    }
  }

  // Scholarship columns (cols 46-49)
  const scholarshipCols: { colIndex: number; label: string }[] = [];
  for (let c = 46; c <= Math.min(49, maxCol); c++) {
    const header = getCellString(sheet, danceNameRow, c);
    if (header) {
      scholarshipCols.push({ colIndex: c, label: buildMultiDanceLabel(header) });
    }
  }

  // Showcase column (col 51)
  const showcaseCol = 51 <= maxCol ? 51 : -1;

  // Parse age categories from cell A1
  const a1Text = getCellString(sheet, 0, 0);
  const detectedAgeCategories = parseAgeCategories(a1Text);

  const warnings: string[] = [];
  const entries: RawImportEntry[] = [];
  const levelsSet = new Set<string>();
  const studiosSet = new Set<string>();
  const dancesMap: Record<string, Set<string>> = {};
  const peopleMap = new Map<string, { name: string; role: 'student' | 'professional'; studio: string }>();
  const seenStudentStudio = new Map<string, number>();

  for (let r = labelRow + 1; r <= maxRow; r++) {
    const levelRaw = getCellString(sheet, r, 0);
    const ageCategory = getCellString(sheet, r, 1);
    const studioName = getCellString(sheet, r, 2);
    const studentName = getCellString(sheet, r, 4);
    const teacherName = getCellString(sheet, r, 5);
    const partnershipRaw = getCellString(sheet, r, 6);

    // Skip blank rows
    if (!levelRaw && !studentName) continue;

    // Warnings for incomplete rows
    if (levelRaw && !studentName) {
      warnings.push(`Row ${r + 1}: Level "${levelRaw}" specified but no student name`);
      continue;
    }
    if (!levelRaw && studentName) {
      warnings.push(`Row ${r + 1}: Student "${studentName}" has no level specified`);
    }
    if (!studioName && studentName) {
      warnings.push(`Row ${r + 1}: Student "${studentName}" has no studio specified`);
    }
    if (!teacherName && studentName) {
      warnings.push(`Row ${r + 1}: Student "${studentName}" has no teacher/partner name`);
    }

    const level = normalizeLevel(levelRaw);
    const partnership = partnershipRaw ? normalizePartnership(partnershipRaw) : 'proam';

    // Single dances
    const singleDances: { dance: string; style: string }[] = [];
    for (const mapping of singleDanceMappings) {
      const cellVal = getCellValue(sheet, r, mapping.colIndex);
      if (isCellMarked(cellVal)) {
        singleDances.push({ dance: mapping.dance, style: mapping.style });
        if (!dancesMap[mapping.style]) {
          dancesMap[mapping.style] = new Set();
        }
        dancesMap[mapping.style].add(mapping.dance);
      }
    }

    // Multi-dance
    const multiDanceStyles: string[] = [];
    for (const col of multiDanceCols) {
      const cellVal = getCellValue(sheet, r, col.colIndex);
      if (isCellMarked(cellVal)) {
        multiDanceStyles.push(col.label);
      }
    }

    // Scholarship
    const scholarshipStyles: string[] = [];
    for (const col of scholarshipCols) {
      const cellVal = getCellValue(sheet, r, col.colIndex);
      if (isCellMarked(cellVal)) {
        scholarshipStyles.push(col.label);
      }
    }

    // Showcase
    let showcaseDanceName: string | undefined;
    if (showcaseCol >= 0) {
      const showcaseVal = getCellString(sheet, r, showcaseCol);
      if (showcaseVal) {
        showcaseDanceName = showcaseVal;
      }
    }

    if (level) levelsSet.add(level);
    if (studioName) studiosSet.add(studioName);

    // Track people
    if (studentName) {
      const studentKey = `student:${studentName.toLowerCase()}`;
      if (!peopleMap.has(studentKey)) {
        peopleMap.set(studentKey, { name: studentName, role: 'student', studio: studioName });
      }
    }
    if (teacherName) {
      const teacherKey = `professional:${teacherName.toLowerCase()}`;
      if (!peopleMap.has(teacherKey)) {
        peopleMap.set(teacherKey, { name: teacherName, role: 'professional', studio: studioName });
      }
    }

    // Check for true duplicates (same student, studio, level, age, and teacher)
    if (studentName && studioName) {
      const dupKey = `${studentName.toLowerCase()}|${studioName.toLowerCase()}|${level.toLowerCase()}|${ageCategory.toLowerCase()}|${teacherName.toLowerCase()}`;
      const prevRow = seenStudentStudio.get(dupKey);
      if (prevRow !== undefined) {
        warnings.push(
          `Row ${r + 1}: Duplicate entry for "${studentName}" (${level} ${ageCategory}) from "${studioName}" (also on row ${prevRow + 1})`
        );
      } else {
        seenStudentStudio.set(dupKey, r);
      }
    }

    entries.push({
      rowIndex: r + 1,
      level,
      ageCategory,
      studioName,
      studentName,
      teacherName,
      partnership,
      singleDances,
      multiDanceStyles,
      scholarshipStyles,
      showcaseDanceName,
    });
  }

  // Check for unrecognized dance columns
  for (const mapping of singleDanceMappings) {
    if (mapping.style === 'Unknown') {
      warnings.push(`Column ${mapping.colIndex + 1}: Unrecognized style for dance "${mapping.originalName}"`);
    }
  }

  // Convert dancesMap to plain record
  const detectedDances: Record<string, string[]> = {};
  for (const [style, danceSet] of Object.entries(dancesMap)) {
    detectedDances[style] = Array.from(danceSet).sort();
  }

  const detectedPeople = Array.from(peopleMap.values());
  const detectedLevels = Array.from(levelsSet).sort();
  const detectedStudios = Array.from(studiosSet).sort();

  const eventSummary = buildEventSummary(entries);

  return {
    entries,
    detectedAgeCategories,
    detectedLevels,
    detectedStudios,
    detectedDances,
    detectedPeople,
    eventSummary,
    warnings,
  };
}

function buildEventSummary(entries: RawImportEntry[]): EventSummaryItem[] {
  const eventMap = new Map<string, EventSummaryItem>();

  for (const entry of entries) {
    // Single dance events
    for (const { dance, style } of entry.singleDances) {
      const key = `single:${style}:${dance}:${entry.level}:${entry.ageCategory}`;
      let item = eventMap.get(key);
      if (!item) {
        item = {
          name: `${entry.ageCategory} ${entry.level} ${style} - ${dance}`,
          style,
          level: entry.level,
          ageCategory: entry.ageCategory,
          dances: [dance],
          isMultiDance: false,
          isScholarship: false,
          coupleCount: 0,
          couples: [],
        };
        eventMap.set(key, item);
      }
      item.coupleCount++;
      item.couples.push({ student: entry.studentName, teacher: entry.teacherName });
    }

    // Multi-dance events
    for (const styleLabel of entry.multiDanceStyles) {
      const key = `multi:${styleLabel}:${entry.level}:${entry.ageCategory}`;
      let item = eventMap.get(key);
      if (!item) {
        const dances = getDancesForStyle(styleLabel);
        item = {
          name: `${entry.ageCategory} ${entry.level} ${styleLabel} Multi-Dance`,
          style: styleLabel,
          level: entry.level,
          ageCategory: entry.ageCategory,
          dances,
          isMultiDance: true,
          isScholarship: false,
          coupleCount: 0,
          couples: [],
        };
        eventMap.set(key, item);
      }
      item.coupleCount++;
      item.couples.push({ student: entry.studentName, teacher: entry.teacherName });
    }

    // Scholarship events
    for (const styleLabel of entry.scholarshipStyles) {
      const key = `scholarship:${styleLabel}:${entry.level}:${entry.ageCategory}`;
      let item = eventMap.get(key);
      if (!item) {
        const dances = getDancesForStyle(styleLabel);
        item = {
          name: `${entry.ageCategory} ${entry.level} ${styleLabel} Scholarship`,
          style: styleLabel,
          level: entry.level,
          ageCategory: entry.ageCategory,
          dances,
          isMultiDance: true,
          isScholarship: true,
          coupleCount: 0,
          couples: [],
        };
        eventMap.set(key, item);
      }
      item.coupleCount++;
      item.couples.push({ student: entry.studentName, teacher: entry.teacherName });
    }
  }

  return Array.from(eventMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getDancesForStyle(style: string): string[] {
  switch (style) {
    case 'Smooth':
      return ['Foxtrot', 'Waltz', 'Tango', 'Viennese Waltz'];
    case 'Standard':
      return ['Foxtrot', 'Waltz', 'Tango', 'Quickstep', 'Viennese Waltz'];
    case 'Rhythm':
      return ['Cha Cha', 'Rumba', 'Swing', 'Mambo', 'Bolero'];
    case 'Latin':
      return ['Samba', 'Cha Cha', 'Rumba', 'Jive', 'Paso Doble'];
    default:
      return [];
  }
}
