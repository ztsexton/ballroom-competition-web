import { Judge, JudgeBreakConfig, ScheduledHeat, ScheduleVariant, Event } from '../../types';
import { generateHeatId } from './helpers';

interface JudgeState {
  judge: Judge;
  workMinutes: number;
  onBreak: boolean;
  breakRemainingMinutes: number;
  totalWorkMinutes: number;
  longestSessionMinutes: number;
  currentSessionMinutes: number;
}

/**
 * Generates 3 schedule variant options with main/fill-in judge break scheduling.
 *
 * Each variant produces the same base heat order but with different break
 * placements and judge assignments per heat.
 */
export function generateJudgeBreakVariants(
  baseHeatOrder: ScheduledHeat[],
  judges: Judge[],
  events: Record<number, Event>,
  config: JudgeBreakConfig,
): ScheduleVariant[] {
  const mains = judges.filter(j => j.judgeRole !== 'fill-in');
  const fillIns = judges.filter(j => j.judgeRole === 'fill-in');

  if (mains.length === 0 || fillIns.length === 0) {
    // Can't do main/fill-in without both roles
    return [];
  }

  const strategies: Array<{
    id: string;
    label: string;
    description: string;
    breakOffsetFraction: number; // How far into the session the first break starts (0-1)
    lunchPlacement: 'early' | 'late' | 'middle';
  }> = [
    {
      id: 'even-stagger',
      label: 'Option A: Even Stagger',
      description: 'Judge breaks are evenly distributed throughout the session for consistent coverage.',
      breakOffsetFraction: 0.5,
      lunchPlacement: 'middle',
    },
    {
      id: 'early-lunch',
      label: 'Option B: Early Lunch',
      description: 'Lunch placed early in the window. More afternoon work before first post-lunch break.',
      breakOffsetFraction: 0.3,
      lunchPlacement: 'early',
    },
    {
      id: 'late-lunch',
      label: 'Option C: Late Lunch',
      description: 'More morning work before lunch. Breaks compressed into the afternoon.',
      breakOffsetFraction: 0.7,
      lunchPlacement: 'late',
    },
  ];

  return strategies.map(strategy => {
    const result = applyBreakStrategy(
      baseHeatOrder,
      mains,
      fillIns,
      events,
      config,
      strategy.breakOffsetFraction,
      strategy.lunchPlacement,
    );

    return {
      id: strategy.id,
      label: strategy.label,
      description: strategy.description,
      heatOrder: result.heatOrder,
      stats: {
        totalHeats: result.heatOrder.length,
        estimatedDurationMinutes: result.estimatedDurationMinutes,
        breakCount: result.breakCount,
        lunchPlacement: result.lunchPlacement,
        judgeStats: result.judgeStats,
      },
    };
  });
}

function applyBreakStrategy(
  baseHeatOrder: ScheduledHeat[],
  mains: Judge[],
  fillIns: Judge[],
  events: Record<number, Event>,
  config: JudgeBreakConfig,
  breakOffsetFraction: number,
  lunchPlacement: 'early' | 'late' | 'middle',
): {
  heatOrder: ScheduledHeat[];
  estimatedDurationMinutes: number;
  breakCount: number;
  lunchPlacement?: string;
  judgeStats: Array<{
    judgeId: number;
    judgeName: string;
    judgeRole: 'main' | 'fill-in';
    workMinutes: number;
    longestSessionMinutes: number;
  }>;
} {
  // Deep clone heat order so we don't mutate the original
  const heatOrder: ScheduledHeat[] = JSON.parse(JSON.stringify(baseHeatOrder));

  // Initialize judge states
  const mainStates: JudgeState[] = mains.map(j => ({
    judge: j,
    workMinutes: 0,
    onBreak: false,
    breakRemainingMinutes: 0,
    totalWorkMinutes: 0,
    longestSessionMinutes: 0,
    currentSessionMinutes: 0,
  }));

  const fillInStates: JudgeState[] = fillIns.map(j => ({
    judge: j,
    workMinutes: 0,
    onBreak: false,
    breakRemainingMinutes: 0,
    totalWorkMinutes: 0,
    longestSessionMinutes: 0,
    currentSessionMinutes: 0,
  }));

  // Stagger initial work: offset each main judge's "break trigger" time
  const staggerOffsetMinutes = (config.maxSessionMinutes * breakOffsetFraction) / mains.length;
  mainStates.forEach((ms, i) => {
    // Start each judge with some "pre-work" to stagger their breaks
    ms.workMinutes = i * staggerOffsetMinutes;
    ms.currentSessionMinutes = i * staggerOffsetMinutes;
  });

  let breakCount = 0;
  let lunchInserted = false;
  let lunchPlacementTime: string | undefined;
  let cumulativeMinutes = 0;

  // Calculate lunch insertion window
  const lunchConfig = config.lunchBreak;
  let lunchEarliestMinutes = 0;
  let lunchLatestMinutes = Infinity;
  if (lunchConfig?.enabled) {
    // Parse times relative to first heat
    const firstHeatTime = heatOrder.find(h => !h.isBreak)?.estimatedStartTime;
    if (firstHeatTime) {
      const startMs = new Date(firstHeatTime).getTime();
      if (lunchConfig.earliestTime) {
        const [h, m] = lunchConfig.earliestTime.split(':').map(Number);
        const target = new Date(firstHeatTime);
        target.setHours(h, m, 0, 0);
        lunchEarliestMinutes = Math.max(0, (target.getTime() - startMs) / 60000);
      }
      if (lunchConfig.latestTime) {
        const [h, m] = lunchConfig.latestTime.split(':').map(Number);
        const target = new Date(firstHeatTime);
        target.setHours(h, m, 0, 0);
        lunchLatestMinutes = Math.max(0, (target.getTime() - startMs) / 60000);
      }
    }

    // Adjust based on strategy
    if (lunchPlacement === 'early') {
      lunchLatestMinutes = Math.min(lunchLatestMinutes, lunchEarliestMinutes + 30);
    } else if (lunchPlacement === 'late') {
      lunchEarliestMinutes = Math.max(lunchEarliestMinutes, lunchLatestMinutes - 30);
    }
  }

  // Build the result heat order with judge assignments and break insertions
  const resultHeatOrder: ScheduledHeat[] = [];

  for (let i = 0; i < heatOrder.length; i++) {
    const heat = heatOrder[i];

    if (heat.isBreak) {
      resultHeatOrder.push(heat);
      // Reset all judges' work counters on existing breaks
      for (const ms of mainStates) {
        if (ms.currentSessionMinutes > ms.longestSessionMinutes) {
          ms.longestSessionMinutes = ms.currentSessionMinutes;
        }
        ms.workMinutes = 0;
        ms.currentSessionMinutes = 0;
        ms.onBreak = false;
        ms.breakRemainingMinutes = 0;
      }
      for (const fs of fillInStates) {
        fs.workMinutes = 0;
        fs.currentSessionMinutes = 0;
      }
      continue;
    }

    const heatDurationMinutes = (heat.estimatedDurationSeconds || 120) / 60;

    // Check if we should insert lunch
    if (lunchConfig?.enabled && !lunchInserted &&
        cumulativeMinutes >= lunchEarliestMinutes &&
        cumulativeMinutes <= lunchLatestMinutes) {
      const lunchHeat: ScheduledHeat = {
        id: generateHeatId(),
        entries: [],
        isBreak: true,
        breakLabel: 'Lunch Break',
        breakDuration: lunchConfig.durationMinutes,
      };
      resultHeatOrder.push(lunchHeat);
      lunchInserted = true;
      breakCount++;

      // Compute lunch time display
      if (heat.estimatedStartTime) {
        const d = new Date(heat.estimatedStartTime);
        const h = d.getHours();
        const m = d.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        lunchPlacementTime = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      }

      // Reset all judge work counters
      for (const ms of mainStates) {
        if (ms.currentSessionMinutes > ms.longestSessionMinutes) {
          ms.longestSessionMinutes = ms.currentSessionMinutes;
        }
        ms.workMinutes = 0;
        ms.currentSessionMinutes = 0;
        ms.onBreak = false;
        ms.breakRemainingMinutes = 0;
      }
      for (const fs of fillInStates) {
        fs.workMinutes = 0;
        fs.currentSessionMinutes = 0;
      }
    }

    // Determine which judges are active for this heat
    const activeJudgeIds: number[] = [];

    // Process main judge breaks
    for (const ms of mainStates) {
      if (ms.onBreak) {
        ms.breakRemainingMinutes -= heatDurationMinutes;
        if (ms.breakRemainingMinutes <= 0) {
          ms.onBreak = false;
          ms.workMinutes = 0;
          ms.currentSessionMinutes = 0;
        }
      }

      if (!ms.onBreak) {
        // Check if this main judge needs a break
        if (ms.workMinutes >= config.maxSessionMinutes) {
          // Only go on break if no other main is currently on break
          const othersOnBreak = mainStates.filter(other => other !== ms && other.onBreak);
          if (othersOnBreak.length === 0) {
            ms.onBreak = true;
            ms.breakRemainingMinutes = config.breakDurationMinutes;
            if (ms.currentSessionMinutes > ms.longestSessionMinutes) {
              ms.longestSessionMinutes = ms.currentSessionMinutes;
            }
            ms.currentSessionMinutes = 0;
            breakCount++;
          }
        }
      }

      if (!ms.onBreak) {
        activeJudgeIds.push(ms.judge.id);
      }
    }

    // Fill-in judges work when a main judge is on break
    const mainOnBreak = mainStates.some(ms => ms.onBreak);
    if (mainOnBreak) {
      // Pick fill-in with the least work
      const bestFillIn = fillInStates.reduce((best, curr) =>
        curr.totalWorkMinutes < best.totalWorkMinutes ? curr : best
      );
      activeJudgeIds.push(bestFillIn.judge.id);
      bestFillIn.totalWorkMinutes += heatDurationMinutes;
      bestFillIn.currentSessionMinutes += heatDurationMinutes;
    }

    // Assign judges to all entries in this heat
    for (const entry of heat.entries) {
      const event = events[entry.eventId];
      if (!event) continue;
      const eventHeat = event.heats.find(h => h.round === entry.round);
      if (eventHeat) {
        eventHeat.judges = activeJudgeIds;
      }
    }

    // Update work timers for active main judges
    for (const ms of mainStates) {
      if (!ms.onBreak) {
        ms.workMinutes += heatDurationMinutes;
        ms.currentSessionMinutes += heatDurationMinutes;
        ms.totalWorkMinutes += heatDurationMinutes;
      }
    }

    cumulativeMinutes += heatDurationMinutes;
    resultHeatOrder.push(heat);
  }

  // Finalize longest sessions
  for (const ms of mainStates) {
    if (ms.currentSessionMinutes > ms.longestSessionMinutes) {
      ms.longestSessionMinutes = ms.currentSessionMinutes;
    }
  }
  for (const fs of fillInStates) {
    if (fs.currentSessionMinutes > fs.longestSessionMinutes) {
      fs.longestSessionMinutes = fs.currentSessionMinutes;
    }
  }

  // Build judge stats
  const judgeStats = [
    ...mainStates.map(ms => ({
      judgeId: ms.judge.id,
      judgeName: ms.judge.name,
      judgeRole: 'main' as const,
      workMinutes: Math.round(ms.totalWorkMinutes),
      longestSessionMinutes: Math.round(ms.longestSessionMinutes),
    })),
    ...fillInStates.map(fs => ({
      judgeId: fs.judge.id,
      judgeName: fs.judge.name,
      judgeRole: 'fill-in' as const,
      workMinutes: Math.round(fs.totalWorkMinutes),
      longestSessionMinutes: Math.round(fs.longestSessionMinutes),
    })),
  ];

  // Calculate total duration
  let totalDurationMinutes = 0;
  for (const heat of resultHeatOrder) {
    if (heat.isBreak) {
      totalDurationMinutes += (heat.breakDuration || 5);
    } else {
      totalDurationMinutes += (heat.estimatedDurationSeconds || 120) / 60;
    }
  }

  return {
    heatOrder: resultHeatOrder,
    estimatedDurationMinutes: Math.round(totalDurationMinutes),
    breakCount,
    lunchPlacement: lunchPlacementTime,
    judgeStats,
  };
}
