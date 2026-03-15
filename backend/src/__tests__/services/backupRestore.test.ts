import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { JsonDataService } from '../../services/data/JsonDataService';
import { importAllData, exportAllData, BackupData } from '../../services/backupService';
import * as dataServiceModule from '../../services/dataService';

// Point dataService to a fresh JsonDataService for testing
const testDs = new JsonDataService();
Object.defineProperty(dataServiceModule, 'dataService', { value: testDs, writable: true });

const BACKUP_PATH = path.join(__dirname, '..', '..', '..', '..', 'backup-test.gz');

describe('Backup Restore (old format compatibility)', () => {
  let backup: BackupData;

  beforeAll(() => {
    if (!fs.existsSync(BACKUP_PATH)) {
      throw new Error(`backup-test.gz not found at ${BACKUP_PATH}`);
    }
    const gz = fs.readFileSync(BACKUP_PATH);
    const json = zlib.gunzipSync(gz).toString();
    backup = JSON.parse(json);
  });

  beforeEach(async () => {
    await testDs.resetAllData();
  });

  it('should import old-format backup without errors', async () => {
    const result = await importAllData(backup);
    expect(result.competitionsRestored).toBe(backup.competitions.length);
    expect(result.usersRestored).toBe(backup.users.length);
  });

  it('should restore correct number of people, couples, and events', async () => {
    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    expect(comps.length).toBe(backup.competitions.length);

    const compData = backup.competitionData[backup.competitions[0].id];
    const people = await testDs.getPeople(comps[0].id);
    expect(people.length).toBe(compData.people.length);

    const couples = await testDs.getCouples(comps[0].id);
    expect(couples.length).toBe(compData.couples.length);

    const events = await testDs.getEvents(comps[0].id);
    expect(Object.keys(events).length).toBe(Object.keys(compData.events).length);
  });

  it('should assign id and bib to all couples (old format had no id)', async () => {
    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    const couples = await testDs.getCouples(comps[0].id);

    for (const couple of couples) {
      expect(couple.id).toBeDefined();
      expect(typeof couple.id).toBe('number');
      expect(couple.bib).toBeDefined();
      expect(typeof couple.bib).toBe('number');
      expect(couple.bib).toBeGreaterThan(0);
    }
  });

  it('should assign bibs to leader people', async () => {
    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    const people = await testDs.getPeople(comps[0].id);
    const couples = await testDs.getCouples(comps[0].id);

    // Every leader in a couple should have a bib
    const leaderIds = new Set(couples.map(c => c.leaderId));
    const leaders = people.filter(p => leaderIds.has(p.id));
    for (const leader of leaders) {
      expect(leader.bib).toBeDefined();
      expect(leader.bib).toBeGreaterThan(0);
    }
  });

  it('should restore billTo on couples', async () => {
    const compData = backup.competitionData[backup.competitions[0].id];
    const originalBillToCount = compData.couples.filter((c: any) => c.billTo).length;
    expect(originalBillToCount).toBeGreaterThan(0); // sanity check

    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    const couples = await testDs.getCouples(comps[0].id);
    const restoredBillToCount = couples.filter(c => c.billTo).length;

    expect(restoredBillToCount).toBe(originalBillToCount);
  });

  it('should restore legacy entry payments from competition JSONB', async () => {
    const comp = backup.competitions[0] as any;
    const legacyPayments = comp.entryPayments;
    expect(legacyPayments).toBeDefined();
    expect(Object.keys(legacyPayments).length).toBeGreaterThan(0);

    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    const payments = await testDs.getEntryPayments(comps[0].id);
    expect(Object.keys(payments).length).toBeGreaterThan(0);
  });

  it('should correctly remap bibs in event heats', async () => {
    await importAllData(backup);

    const comps = await testDs.getCompetitions();
    const couples = await testDs.getCouples(comps[0].id);
    const events = await testDs.getEvents(comps[0].id);

    // All bibs in event heats should be valid (exist in couples)
    const validBibs = new Set(couples.map(c => c.bib));
    for (const event of Object.values(events)) {
      for (const heat of event.heats) {
        for (const bib of heat.bibs) {
          expect(validBibs.has(bib)).toBe(true);
        }
      }
    }
  });

  it('should round-trip: export after import produces valid data', async () => {
    await importAllData(backup);

    const exported = await exportAllData();
    expect(exported.version).toBe(1);
    expect(exported.competitions.length).toBe(backup.competitions.length);

    // All couples in export should have id field
    for (const [, compData] of Object.entries(exported.competitionData)) {
      for (const couple of compData.couples) {
        expect(couple.id).toBeDefined();
      }
    }

    // Re-import the exported data
    await testDs.resetAllData();
    const result = await importAllData(exported);
    expect(result.competitionsRestored).toBe(backup.competitions.length);
  });
});
