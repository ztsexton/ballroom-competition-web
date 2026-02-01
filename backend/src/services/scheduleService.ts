import { CompetitionSchedule, EventRunStatus, ScheduledHeat, Event, JudgeSettings } from '../types';
import { dataService } from './dataService';
import { DEFAULT_LEVELS } from '../constants/levels';

const DEFAULT_STYLE_ORDER = ['Smooth', 'Rhythm', 'Standard', 'Latin'];

class ScheduleService {
  private heatKey(heat: ScheduledHeat): string {
    return `${heat.eventId}:${heat.round}`;
  }

  generateSchedule(
    competitionId: number,
    styleOrder?: string[],
    levelOrder?: string[],
  ): CompetitionSchedule {
    const competition = dataService.getCompetitionById(competitionId);
    const events = dataService.getEvents(competitionId);
    const eventList = Object.values(events);

    const styles = styleOrder || DEFAULT_STYLE_ORDER;
    const levels = levelOrder || competition?.levels || DEFAULT_LEVELS;

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

    // Group heats by round depth (0 = first round, 1 = second, 2 = third)
    const buckets: ScheduledHeat[][] = [[], [], []];

    for (const event of eventList) {
      event.heats.forEach((heat, index) => {
        if (index < 3) {
          buckets[index].push({ eventId: event.id, round: heat.round });
        }
      });
    }

    // Sort events within each bucket by style then level
    for (const bucket of buckets) {
      bucket.sort((a, b) => {
        const eventA = events[a.eventId];
        const eventB = events[b.eventId];
        if (!eventA || !eventB) return 0;
        return sortByStyleLevel(eventA, eventB);
      });
    }

    const heatOrder = [...buckets[0], ...buckets[1], ...buckets[2]];

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

    const saved = dataService.saveSchedule(schedule);
    this.autoAssignJudges(competitionId);
    return saved;
  }

  autoAssignJudges(competitionId: number): void {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return;

    const judges = dataService.getJudges(competitionId)
      .sort((a, b) => a.judgeNumber - b.judgeNumber);
    if (judges.length === 0) return;

    const events = dataService.getEvents(competitionId);
    const competition = dataService.getCompetitionById(competitionId);
    const settings: JudgeSettings = competition?.judgeSettings || { defaultCount: 3, levelOverrides: {} };

    let judgeIndex = 0;

    for (const scheduledHeat of schedule.heatOrder) {
      if (scheduledHeat.isBreak) continue;

      const event = events[scheduledHeat.eventId];
      if (!event) continue;

      const heat = event.heats.find(h => h.round === scheduledHeat.round);
      if (!heat) continue;

      const requiredCount = Math.min(
        settings.levelOverrides[event.level || ''] ?? settings.defaultCount,
        judges.length,
      );

      const assigned: number[] = [];
      for (let i = 0; i < requiredCount; i++) {
        assigned.push(judges[judgeIndex % judges.length].id);
        judgeIndex++;
      }
      heat.judges = assigned;
    }

    // Save updated events
    for (const event of Object.values(events)) {
      dataService.updateEvent(event.id, { heats: event.heats });
    }
  }

  reorderHeat(
    competitionId: number,
    fromIndex: number,
    toIndex: number,
  ): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (fromIndex < 0 || fromIndex >= schedule.heatOrder.length) return null;
    if (toIndex < 0 || toIndex >= schedule.heatOrder.length) return null;

    const [moved] = schedule.heatOrder.splice(fromIndex, 1);
    schedule.heatOrder.splice(toIndex, 0, moved);
    schedule.updatedAt = new Date().toISOString();

    return dataService.saveSchedule(schedule);
  }

  advanceHeat(competitionId: number): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
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
      return dataService.saveSchedule(schedule);
    }

    switch (currentStatus) {
      case 'pending':
        schedule.heatStatuses[key] = 'scoring';
        break;
      case 'scoring':
        schedule.heatStatuses[key] = 'completed';
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
        break;
      case 'completed':
        if (schedule.currentHeatIndex < schedule.heatOrder.length - 1) {
          schedule.currentHeatIndex++;
        }
        break;
    }

    schedule.updatedAt = new Date().toISOString();
    return dataService.saveSchedule(schedule);
  }

  goBackHeat(competitionId: number): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
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
      return dataService.saveSchedule(schedule);
    }

    switch (currentStatus) {
      case 'scoring':
        schedule.heatStatuses[key] = 'pending';
        break;
      case 'pending':
        if (schedule.currentHeatIndex > 0) {
          schedule.currentHeatIndex--;
        }
        break;
    }

    schedule.updatedAt = new Date().toISOString();
    return dataService.saveSchedule(schedule);
  }

  suggestPosition(competitionId: number, eventId: number): number {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return 0;

    const event = dataService.getEventById(eventId);
    if (!event) return schedule.heatOrder.length;

    const styles = schedule.styleOrder;
    const levels = schedule.levelOrder;
    const events = dataService.getEvents(competitionId);

    const eventStyleIdx = styles.indexOf(event.style || '');
    const eventLevelIdx = levels.indexOf(event.level || '');
    const sIdx = eventStyleIdx === -1 ? styles.length : eventStyleIdx;
    const lIdx = eventLevelIdx === -1 ? levels.length : eventLevelIdx;

    // Find where the first-round heat should go among other first-round heats
    for (let i = 0; i < schedule.heatOrder.length; i++) {
      const h = schedule.heatOrder[i];
      if (h.isBreak) continue;
      const existingEvent = dataService.getEventById(h.eventId);
      if (!existingEvent) continue;

      // Only compare against first-round heats (the event's heats[0].round)
      if (existingEvent.heats[0]?.round !== h.round) continue;

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
      if (h.isBreak) continue;
      const existingEvent = dataService.getEventById(h.eventId);
      if (!existingEvent) continue;
      if (existingEvent.heats.length > 1 && existingEvent.heats[1]?.round === h.round) {
        return i;
      }
    }

    return schedule.heatOrder.length;
  }

  insertEvent(
    competitionId: number,
    eventId: number,
    position: number,
  ): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const event = dataService.getEventById(eventId);
    if (!event) return null;

    // Don't insert if any heat of this event is already scheduled
    if (schedule.heatOrder.some(h => h.eventId === eventId)) return schedule;

    // Insert first-round heat at specified position
    const firstHeat: ScheduledHeat = { eventId, round: event.heats[0].round };
    const insertAt = Math.max(0, Math.min(position, schedule.heatOrder.length));
    schedule.heatOrder.splice(insertAt, 0, firstHeat);
    schedule.heatStatuses[this.heatKey(firstHeat)] = 'pending';

    if (insertAt <= schedule.currentHeatIndex) {
      schedule.currentHeatIndex++;
    }

    // Insert subsequent rounds at the end of their round-depth groups
    for (let roundIdx = 1; roundIdx < event.heats.length; roundIdx++) {
      const heat: ScheduledHeat = { eventId, round: event.heats[roundIdx].round };

      // Find the last heat that is the same round depth for its event
      let insertPos = schedule.heatOrder.length;
      for (let i = schedule.heatOrder.length - 1; i >= 0; i--) {
        const existing = schedule.heatOrder[i];
        if (existing.isBreak) continue;
        const existingEvent = dataService.getEventById(existing.eventId);
        if (!existingEvent) continue;
        const existingRoundIdx = existingEvent.heats.findIndex(h => h.round === existing.round);
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
    const saved = dataService.saveSchedule(schedule);
    this.autoAssignJudges(competitionId);
    return saved;
  }

  addBreak(
    competitionId: number,
    label: string,
    duration?: number,
    position?: number,
  ): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return null;

    const breakHeat: ScheduledHeat = {
      eventId: 0,
      round: `break-${Date.now()}`,
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
    return dataService.saveSchedule(schedule);
  }

  removeBreak(
    competitionId: number,
    heatIndex: number,
  ): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
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
    return dataService.saveSchedule(schedule);
  }

  jumpToHeat(competitionId: number, heatIndex: number): CompetitionSchedule | null {
    const schedule = dataService.getSchedule(competitionId);
    if (!schedule) return null;
    if (heatIndex < 0 || heatIndex >= schedule.heatOrder.length) return null;

    schedule.currentHeatIndex = heatIndex;
    schedule.updatedAt = new Date().toISOString();

    return dataService.saveSchedule(schedule);
  }
}

export const scheduleService = new ScheduleService();
