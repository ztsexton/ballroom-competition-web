import { CompetitionSchedule, EventRunStatus, ScheduledHeat, HeatEntry, Event, JudgeSettings } from '../types';
import { dataService } from './dataService';
import { timingService, DEFAULT_TIMING } from './timingService';
import { DEFAULT_LEVELS } from '../constants/levels';

const DEFAULT_STYLE_ORDER = ['Smooth', 'Rhythm', 'Standard', 'Latin'];
const DEFAULT_MAX_COUPLES_PER_HEAT = 6;

export class ScheduleService {
  private heatKey(heat: ScheduledHeat): string {
    return heat.id;
  }

  private generateHeatId(): string {
    return `heat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get the ordered union of dances across all entries in a heat.
   * Returns empty array for single-dance or no-dance heats.
   */
  async getDancesForHeat(heat: ScheduledHeat): Promise<string[]> {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const entry of heat.entries) {
      const event = await dataService.getEventById(entry.eventId);
      if (event?.dances && event.dances.length > 1) {
        for (const d of event.dances) {
          if (!seen.has(d)) {
            seen.add(d);
            result.push(d);
          }
        }
      }
    }
    return result;
  }

  /**
   * Migrate old-format schedules (eventId/round on ScheduledHeat) to new format (entries array + id).
   */
  static migrateSchedule(schedule: CompetitionSchedule): CompetitionSchedule {
    if (schedule.heatOrder.length === 0) return schedule;

    // Detect old format: first non-break heat has no `id` field
    const firstHeat = schedule.heatOrder[0];
    if (firstHeat.id && firstHeat.entries) return schedule; // Already new format

    const newHeatOrder: ScheduledHeat[] = [];
    const newStatuses: Record<string, EventRunStatus> = {};

    for (const oldHeat of schedule.heatOrder as any[]) {
      const id = `heat-migrated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const newHeat: ScheduledHeat = {
        id,
        entries: oldHeat.isBreak ? [] : [{ eventId: oldHeat.eventId, round: oldHeat.round }],
        isBreak: oldHeat.isBreak,
        breakLabel: oldHeat.breakLabel,
        breakDuration: oldHeat.breakDuration,
      };
      newHeatOrder.push(newHeat);

      const oldKey = `${oldHeat.eventId}:${oldHeat.round}`;
      newStatuses[id] = schedule.heatStatuses[oldKey] || 'pending';
    }

    schedule.heatOrder = newHeatOrder;
    schedule.heatStatuses = newStatuses;
    return schedule;
  }

  async generateSchedule(
    competitionId: number,
    styleOrder?: string[],
    levelOrder?: string[],
  ): Promise<CompetitionSchedule> {
    const competition = await dataService.getCompetitionById(competitionId);
    const events = await dataService.getEvents(competitionId);
    const eventList = Object.values(events);

    const styles = styleOrder || DEFAULT_STYLE_ORDER;
    const levels = levelOrder || competition?.levels || DEFAULT_LEVELS;
    const maxCouples = competition?.maxCouplesPerHeat ?? DEFAULT_MAX_COUPLES_PER_HEAT;

    const sortByStyleLevel = (a: Event, b: Event) => {
      const sA = styles.indexOf(a.style || '');
      const sB = styles.indexOf(b.style || '');
      const styleA = sA === -1 ? styles.length : sA;
      const styleB = sB === -1 ? styles.length : sB;
      if (styleA !== styleB) return styleA - styleB;

      const lA = levels.indexOf(a.level || '');
      const lB = levels.indexOf(b.level || '');
      const levelA = lA === -1 ? levels.length : lA;
      const levelB = lB === -1 ? levels.length : lB;
      return levelA - levelB;
    };

    // Build entry lists per round depth, sorted by style+level
    type EntryWithEvent = { entry: HeatEntry; event: Event; coupleCount: number };
    const buckets: EntryWithEvent[][] = [[], [], []];

    for (const event of eventList) {
      // Total couple count from first round (later rounds have empty bibs until scored)
      const totalCouples = event.heats[0]?.bibs.length ?? 0;
      event.heats.forEach((heat, index) => {
        if (index < 3) {
          buckets[index].push({
            entry: { eventId: event.id, round: heat.round },
            event,
            coupleCount: totalCouples,
          });
        }
      });
    }

    // Sort within each bucket by style then level
    for (const bucket of buckets) {
      bucket.sort((a, b) => sortByStyleLevel(a.event, b.event));
    }

    // Merge compatible events within each bucket
    const mergedBuckets: ScheduledHeat[][] = [];
    for (const bucket of buckets) {
      mergedBuckets.push(this.mergeEntries(bucket, maxCouples));
    }

    const heatOrder = [...mergedBuckets[0], ...mergedBuckets[1], ...mergedBuckets[2]];

    const heatStatuses: Record<string, EventRunStatus> = {};
    heatOrder.forEach(h => { heatStatuses[this.heatKey(h)] = 'pending'; });

    const now = new Date().toISOString();

    const schedule: CompetitionSchedule = {
      competitionId,
      heatOrder,
      styleOrder: styles,
      levelOrder: levels,
      currentHeatIndex: 0,
      heatStatuses,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await dataService.saveSchedule(schedule);
    await this.autoAssignJudges(competitionId);
    return await this.recalculateTimingIfConfigured(competitionId, saved);
  }

  /**
   * Merge compatible entries into multi-entry heats using first-fit-decreasing.
   * Two entries can share a heat if they have the same style, dances, and scoringType,
   * their combined couple count doesn't exceed maxCouples, and neither event has
   * multiple rounds (events with multiple rounds are never combined).
   */
  private mergeEntries(
    items: Array<{ entry: HeatEntry; event: Event; coupleCount: number }>,
    maxCouples: number,
  ): ScheduledHeat[] {
    // Events with multiple rounds are never combined — give each its own heat
    const mergeable: typeof items = [];
    const result: ScheduledHeat[] = [];

    for (const item of items) {
      if (item.event.heats.length > 1) {
        result.push({
          id: this.generateHeatId(),
          entries: [item.entry],
        });
      } else {
        mergeable.push(item);
      }
    }

    // Group mergeable entries by key: (style, dances sorted, scoringType)
    const groups = new Map<string, typeof items>();
    for (const item of mergeable) {
      const danceKey = (item.event.dances || []).slice().sort().join(',');
      const key = `${item.event.style || ''}|${danceKey}|${item.event.scoringType || 'standard'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const [, group] of groups) {
      // Sort by couple count descending for first-fit-decreasing packing
      const sorted = [...group].sort((a, b) => b.coupleCount - a.coupleCount);

      const heats: { entries: HeatEntry[]; totalCouples: number }[] = [];

      for (const item of sorted) {
        // Try to fit into an existing heat
        let placed = false;
        for (const heat of heats) {
          if (heat.totalCouples + item.coupleCount <= maxCouples) {
            heat.entries.push(item.entry);
            heat.totalCouples += item.coupleCount;
            placed = true;
            break;
          }
        }
        if (!placed) {
          heats.push({ entries: [item.entry], totalCouples: item.coupleCount });
        }
      }

      for (const heat of heats) {
        result.push({
          id: this.generateHeatId(),
          entries: heat.entries,
        });
      }
    }

    // Sort result heats by style/level of their first entry to maintain ordering
    result.sort((a, b) => {
      const aFirst = items.find(i => i.entry.eventId === a.entries[0]?.eventId);
      const bFirst = items.find(i => i.entry.eventId === b.entries[0]?.eventId);
      if (!aFirst || !bFirst) return 0;
      const aIdx = items.indexOf(aFirst);
      const bIdx = items.indexOf(bFirst);
      return aIdx - bIdx;
    });

    return result;
  }

  async autoAssignJudges(competitionId: number): Promise<void> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return;

    const judges = (await dataService.getJudges(competitionId))
      .sort((a, b) => a.judgeNumber - b.judgeNumber);
    if (judges.length === 0) return;

    const events = await dataService.getEvents(competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
    const settings: JudgeSettings = competition?.judgeSettings || { defaultCount: 3, levelOverrides: {} };

    let judgeIndex = 0;

    for (const scheduledHeat of schedule.heatOrder) {
      if (scheduledHeat.isBreak || scheduledHeat.entries.length === 0) continue;

      // Determine required judge count: max of all entries' level requirements
      const requiredCount = Math.min(
        Math.max(...scheduledHeat.entries.map(entry => {
          const event = events[entry.eventId];
          return settings.levelOverrides[event?.level || ''] ?? settings.defaultCount;
        })),
        judges.length,
      );

      const assigned: number[] = [];
      for (let i = 0; i < requiredCount; i++) {
        assigned.push(judges[judgeIndex % judges.length].id);
        judgeIndex++;
      }

      // Propagate same judges to all entries' event heat objects
      for (const entry of scheduledHeat.entries) {
        const event = events[entry.eventId];
        if (!event) continue;
        const heat = event.heats.find(h => h.round === entry.round);
        if (heat) heat.judges = assigned;
      }
    }

    // Save updated events
    for (const event of Object.values(events)) {
      await dataService.updateEvent(event.id, { heats: event.heats });
    }
  }

  async reorderHeat(
    competitionId: number,
    fromIndex: number,
    toIndex: number,
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (fromIndex < 0 || fromIndex >= schedule.heatOrder.length) return null;
    if (toIndex < 0 || toIndex >= schedule.heatOrder.length) return null;

    const [moved] = schedule.heatOrder.splice(fromIndex, 1);
    schedule.heatOrder.splice(toIndex, 0, moved);
    schedule.updatedAt = new Date().toISOString();

    await dataService.saveSchedule(schedule);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  async advanceHeat(competitionId: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return schedule;

    const key = this.heatKey(currentHeat);
    const currentStatus = schedule.heatStatuses[key] || 'pending';

    if (currentHeat.isBreak) {
      if (currentStatus === 'pending') {
        schedule.heatStatuses[key] = 'completed';
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
      } else if (currentStatus === 'completed') {
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
      }
      schedule.updatedAt = new Date().toISOString();
      return await dataService.saveSchedule(schedule);
    }

    switch (currentStatus) {
      case 'pending': {
        schedule.heatStatuses[key] = 'scoring';
        currentHeat.actualStartTime = new Date().toISOString();
        // Auto-set currentDance for multi-dance heats
        const dances = await this.getDancesForHeat(currentHeat);
        schedule.currentDance = dances.length > 0 ? dances[0] : undefined;
        break;
      }
      case 'scoring':
        schedule.heatStatuses[key] = 'completed';
        schedule.currentDance = undefined;
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
        break;
      case 'completed':
        schedule.currentDance = undefined;
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
        break;
    }

    schedule.updatedAt = new Date().toISOString();
    const saved = await dataService.saveSchedule(schedule);

    // Recalculate future estimated times when a heat starts or completes
    if (currentStatus === 'pending' || currentStatus === 'scoring') {
      const competition = await dataService.getCompetitionById(competitionId);
      if (competition?.timingSettings?.startTime) {
        const events = await dataService.getEvents(competitionId);
        const settings = { ...DEFAULT_TIMING, ...competition.timingSettings };
        timingService.recalculateFromIndex(
          saved.heatOrder,
          saved.currentHeatIndex,
          events,
          settings,
          new Date().toISOString(),
        );
        return await dataService.saveSchedule(saved);
      }
    }
    return saved;
  }

  async goBackHeat(competitionId: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat) return schedule;

    const key = this.heatKey(currentHeat);
    const currentStatus = schedule.heatStatuses[key] || 'pending';

    if (currentHeat.isBreak) {
      if (currentStatus === 'completed') {
        schedule.heatStatuses[key] = 'pending';
      } else if (currentStatus === 'pending') {
        if (schedule.currentHeatIndex > 0) {
          schedule.currentHeatIndex--;
        }
      }
      schedule.updatedAt = new Date().toISOString();
      return await dataService.saveSchedule(schedule);
    }

    switch (currentStatus) {
      case 'scoring':
        schedule.heatStatuses[key] = 'pending';
        schedule.currentDance = undefined;
        break;
      case 'pending':
        if (schedule.currentHeatIndex > 0) {
          schedule.currentHeatIndex--;
        }
        break;
    }

    schedule.updatedAt = new Date().toISOString();
    return await dataService.saveSchedule(schedule);
  }

  async advanceDance(competitionId: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat || currentHeat.isBreak) return schedule;

    const dances = await this.getDancesForHeat(currentHeat);
    if (dances.length === 0) return schedule;

    const currentIdx = schedule.currentDance ? dances.indexOf(schedule.currentDance) : -1;
    const nextIdx = currentIdx + 1;
    if (nextIdx < dances.length) {
      schedule.currentDance = dances[nextIdx];
      schedule.updatedAt = new Date().toISOString();
      return await dataService.saveSchedule(schedule);
    }

    return schedule;
  }

  async backDance(competitionId: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const currentHeat = schedule.heatOrder[schedule.currentHeatIndex];
    if (!currentHeat || currentHeat.isBreak) return schedule;

    const dances = await this.getDancesForHeat(currentHeat);
    if (dances.length === 0) return schedule;

    const currentIdx = schedule.currentDance ? dances.indexOf(schedule.currentDance) : -1;
    if (currentIdx > 0) {
      schedule.currentDance = dances[currentIdx - 1];
      schedule.updatedAt = new Date().toISOString();
      return await dataService.saveSchedule(schedule);
    }

    return schedule;
  }

  async suggestPosition(competitionId: number, eventId: number): Promise<number> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return 0;

    const event = await dataService.getEventById(eventId);
    if (!event) return schedule.heatOrder.length;

    const styles = schedule.styleOrder;
    const levels = schedule.levelOrder;

    const eventStyleIdx = styles.indexOf(event.style || '');
    const eventLevelIdx = levels.indexOf(event.level || '');
    const sIdx = eventStyleIdx === -1 ? styles.length : eventStyleIdx;
    const lIdx = eventLevelIdx === -1 ? levels.length : eventLevelIdx;

    // Find where the first-round heat should go among other first-round heats
    for (let i = 0; i < schedule.heatOrder.length; i++) {
      const h = schedule.heatOrder[i];
      if (h.isBreak || h.entries.length === 0) continue;
      // Use first entry for comparison
      const firstEntry = h.entries[0];
      const existingEvent = await dataService.getEventById(firstEntry.eventId);
      if (!existingEvent) continue;

      // Only compare against first-round heats (the event's heats[0].round)
      if (existingEvent.heats[0]?.round !== firstEntry.round) continue;

      const esIdx = styles.indexOf(existingEvent.style || '');
      const elIdx = levels.indexOf(existingEvent.level || '');
      const eStyleIdx = esIdx === -1 ? styles.length : esIdx;
      const eLevelIdx = elIdx === -1 ? levels.length : elIdx;

      if (sIdx < eStyleIdx || (sIdx === eStyleIdx && lIdx < eLevelIdx)) {
        return i;
      }
    }

    // If no first-round heat comes after, place before second-round heats start
    for (let i = 0; i < schedule.heatOrder.length; i++) {
      const h = schedule.heatOrder[i];
      if (h.isBreak || h.entries.length === 0) continue;
      const firstEntry = h.entries[0];
      const existingEvent = await dataService.getEventById(firstEntry.eventId);
      if (!existingEvent) continue;
      if (existingEvent.heats.length > 1 && existingEvent.heats[1]?.round === firstEntry.round) {
        return i;
      }
    }

    return schedule.heatOrder.length;
  }

  async insertEvent(
    competitionId: number,
    eventId: number,
    position: number,
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const event = await dataService.getEventById(eventId);
    if (!event) return null;

    // Don't insert if any heat of this event is already scheduled
    if (schedule.heatOrder.some((h: ScheduledHeat) =>
      h.entries.some(e => e.eventId === eventId)
    )) return schedule;

    // Insert first-round heat at specified position
    const firstHeat: ScheduledHeat = {
      id: this.generateHeatId(),
      entries: [{ eventId, round: event.heats[0].round }],
    };
    const insertAt = Math.max(0, Math.min(position, schedule.heatOrder.length));
    schedule.heatOrder.splice(insertAt, 0, firstHeat);
    schedule.heatStatuses[this.heatKey(firstHeat)] = 'pending';

    if (insertAt <= schedule.currentHeatIndex) {
      schedule.currentHeatIndex++;
    }

    // Insert subsequent rounds at the end of their round-depth groups
    for (let roundIdx = 1; roundIdx < event.heats.length; roundIdx++) {
      const heat: ScheduledHeat = {
        id: this.generateHeatId(),
        entries: [{ eventId, round: event.heats[roundIdx].round }],
      };

      // Find the last heat that is the same round depth for its event
      let insertPos = schedule.heatOrder.length;
      for (let i = schedule.heatOrder.length - 1; i >= 0; i--) {
        const existing = schedule.heatOrder[i];
        if (existing.isBreak || existing.entries.length === 0) continue;
        const existingEntry = existing.entries[0];
        const existingEvent = await dataService.getEventById(existingEntry.eventId);
        if (!existingEvent) continue;
        const existingRoundIdx = existingEvent.heats.findIndex(h => h.round === existingEntry.round);
        if (existingRoundIdx === roundIdx) {
          insertPos = i + 1;
          break;
        }
      }

      schedule.heatOrder.splice(insertPos, 0, heat);
      schedule.heatStatuses[this.heatKey(heat)] = 'pending';

      if (insertPos <= schedule.currentHeatIndex) {
        schedule.currentHeatIndex++;
      }
    }

    schedule.updatedAt = new Date().toISOString();
    await dataService.saveSchedule(schedule);
    await this.autoAssignJudges(competitionId);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  async addBreak(
    competitionId: number,
    label: string,
    duration?: number,
    position?: number,
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const breakHeat: ScheduledHeat = {
      id: this.generateHeatId(),
      entries: [],
      isBreak: true,
      breakLabel: label,
      breakDuration: duration,
    };

    const insertAt = position !== undefined
      ? Math.max(0, Math.min(position, schedule.heatOrder.length))
      : schedule.heatOrder.length;

    schedule.heatOrder.splice(insertAt, 0, breakHeat);
    schedule.heatStatuses[this.heatKey(breakHeat)] = 'pending';

    if (insertAt <= schedule.currentHeatIndex) {
      schedule.currentHeatIndex++;
    }

    schedule.updatedAt = new Date().toISOString();
    await dataService.saveSchedule(schedule);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  async removeBreak(
    competitionId: number,
    heatIndex: number,
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

    const heat = schedule.heatOrder[heatIndex];
    if (!heat.isBreak) return null;

    const key = this.heatKey(heat);
    schedule.heatOrder.splice(heatIndex, 1);
    delete schedule.heatStatuses[key];

    if (heatIndex < schedule.currentHeatIndex) {
      schedule.currentHeatIndex--;
    } else if (heatIndex === schedule.currentHeatIndex && schedule.currentHeatIndex >= schedule.heatOrder.length) {
      schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
    }

    schedule.updatedAt = new Date().toISOString();
    await dataService.saveSchedule(schedule);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  async jumpToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

    schedule.currentHeatIndex = heatIndex;
    schedule.updatedAt = new Date().toISOString();

    return await dataService.saveSchedule(schedule);
  }

  async resetToHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

    // Only clear from target heat through the current position (inclusive)
    const endIndex = Math.max(heatIndex, schedule.currentHeatIndex);
    for (let i = heatIndex; i <= endIndex; i++) {
      const heat = schedule.heatOrder[i];
      const key = this.heatKey(heat);
      const status = schedule.heatStatuses[key];

      if (status && status !== 'pending') {
        schedule.heatStatuses[key] = 'pending';
        if (!heat.isBreak) {
          for (const entry of heat.entries) {
            await dataService.clearScores(entry.eventId, entry.round);
            await dataService.clearJudgeScores(entry.eventId, entry.round);
          }
        }
      }
    }

    schedule.currentHeatIndex = heatIndex;
    schedule.currentDance = undefined;
    schedule.updatedAt = new Date().toISOString();

    return await dataService.saveSchedule(schedule);
  }

  async rerunHeat(competitionId: number, heatIndex: number): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

    const heat = schedule.heatOrder[heatIndex];
    const key = this.heatKey(heat);
    const status = schedule.heatStatuses[key];

    if (status && status !== 'pending') {
      schedule.heatStatuses[key] = 'pending';
      if (!heat.isBreak) {
        for (const entry of heat.entries) {
          await dataService.clearScores(entry.eventId, entry.round);
          await dataService.clearJudgeScores(entry.eventId, entry.round);
        }
      }
    }

    schedule.currentHeatIndex = heatIndex;
    schedule.currentDance = undefined;
    schedule.updatedAt = new Date().toISOString();

    return await dataService.saveSchedule(schedule);
  }

  async updateHeatEntries(
    competitionId: number,
    heatId: string,
    newEntries: HeatEntry[],
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const heatIndex = schedule.heatOrder.findIndex(h => h.id === heatId);
    if (heatIndex === -1) return null;

    const heat = schedule.heatOrder[heatIndex];
    if (heat.isBreak) return null;

    // Validate: all entries must exist and have compatible scoring types
    const events = await dataService.getEvents(competitionId);
    const competition = await dataService.getCompetitionById(competitionId);
    const maxCouples = competition?.maxCouplesPerHeat ?? DEFAULT_MAX_COUPLES_PER_HEAT;

    let totalCouples = 0;
    let scoringType: string | undefined;

    for (const entry of newEntries) {
      const event = events[entry.eventId];
      if (!event) return null;
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (!eventHeat) return null;

      // Use first round's bibs for total (later rounds have empty bibs until scored)
      totalCouples += event.heats[0]?.bibs.length ?? 0;
      const st = event.scoringType || 'standard';
      if (scoringType === undefined) {
        scoringType = st;
      } else if (scoringType !== st) {
        return null; // Incompatible scoring types
      }
    }

    if (totalCouples > maxCouples) return null;
    if (newEntries.length === 0) return null;

    // Remove these entries from any other heats they might be in
    for (const entry of newEntries) {
      for (const otherHeat of schedule.heatOrder) {
        if (otherHeat.id === heatId || otherHeat.isBreak) continue;
        otherHeat.entries = otherHeat.entries.filter(
          e => !(e.eventId === entry.eventId && e.round === entry.round)
        );
      }
    }

    // Remove any heats that are now empty (but not breaks)
    const emptyHeatIds: string[] = [];
    schedule.heatOrder = schedule.heatOrder.filter(h => {
      if (h.id === heatId) return true;
      if (h.isBreak) return true;
      if (h.entries.length === 0) {
        emptyHeatIds.push(h.id);
        return false;
      }
      return true;
    });

    // Clean up statuses for removed heats
    for (const id of emptyHeatIds) {
      delete schedule.heatStatuses[id];
    }

    // Clamp currentHeatIndex if heats were removed before it
    if (schedule.currentHeatIndex >= schedule.heatOrder.length) {
      schedule.currentHeatIndex = Math.max(0, schedule.heatOrder.length - 1);
    }

    heat.entries = newEntries;
    schedule.updatedAt = new Date().toISOString();

    await dataService.saveSchedule(schedule);
    await this.autoAssignJudges(competitionId);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  async splitHeatEntry(
    competitionId: number,
    heatId: string,
    eventId: number,
    round: string,
  ): Promise<CompetitionSchedule | null> {
    const schedule = await dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const heatIndex = schedule.heatOrder.findIndex(h => h.id === heatId);
    if (heatIndex === -1) return null;

    const heat = schedule.heatOrder[heatIndex];
    if (heat.isBreak) return null;
    if (heat.entries.length <= 1) return null; // nothing to split

    const entryIndex = heat.entries.findIndex(
      e => e.eventId === eventId && e.round === round
    );
    if (entryIndex === -1) return null;

    // Remove the entry from this heat
    const [removed] = heat.entries.splice(entryIndex, 1);

    // Create a new single-entry heat right after
    const newHeat: ScheduledHeat = {
      id: this.generateHeatId(),
      entries: [removed],
    };
    schedule.heatOrder.splice(heatIndex + 1, 0, newHeat);
    schedule.heatStatuses[newHeat.id] = schedule.heatStatuses[heatId] || 'pending';

    if (heatIndex < schedule.currentHeatIndex) {
      schedule.currentHeatIndex++;
    }

    schedule.updatedAt = new Date().toISOString();
    await dataService.saveSchedule(schedule);
    await this.autoAssignJudges(competitionId);
    return await this.recalculateTimingIfConfigured(competitionId, schedule);
  }

  private async recalculateTimingIfConfigured(
    competitionId: number,
    schedule: CompetitionSchedule,
  ): Promise<CompetitionSchedule> {
    const competition = await dataService.getCompetitionById(competitionId);
    if (!competition?.timingSettings?.startTime) return schedule;
    const events = await dataService.getEvents(competitionId);
    const settings = { ...DEFAULT_TIMING, ...competition.timingSettings };
    timingService.calculateEstimatedTimes(schedule.heatOrder, events, settings);
    return await dataService.saveSchedule(schedule);
  }
}

export const scheduleService = new ScheduleService();
