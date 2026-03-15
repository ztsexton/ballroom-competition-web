import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { couplesApi, eventsApi, peopleApi } from '../../api/client';
import { Event, DetailedResultsResponse } from '../../types';
import { PersonResultCard, PartnershipEvents } from '../../components/results/PersonResultCard';
import { JudgeGrid } from '../../components/results/JudgeGrid';
import { SkatingBreakdown } from '../../components/results/SkatingBreakdown';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';
import { Skeleton } from '../../components/Skeleton';

const RECALL_ROUNDS = ['quarter-final', 'semi-final'];

function AdminEventResultsDetail({ eventId }: { eventId: number; rounds: string[] }) {
  const [detailed, setDetailed] = useState<DetailedResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRound, setActiveRound] = useState<string>('');
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    setLoading(true);
    eventsApi.getById(eventId)
      .then((r) => {
        setEvent(r.data);
        const lastRound = r.data.heats[r.data.heats.length - 1]?.round || 'final';
        setActiveRound(lastRound);
        return eventsApi.getDetailedResults(eventId, lastRound);
      })
      .then((r) => setDetailed(r.data))
      .catch(() => setDetailed(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  const fetchRound = useCallback((round: string) => {
    setActiveRound(round);
    setLoading(true);
    eventsApi.getDetailedResults(eventId, round)
      .then((r) => setDetailed(r.data))
      .catch(() => setDetailed(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Skeleton variant="table" rows={3} cols={4} />;
  if (!detailed || !event) return <div className="text-sm text-gray-400">No results available.</div>;

  const results = detailed.results;
  const judges = detailed.judges || [];
  const dances = detailed.dances || [];
  const isRecall = RECALL_ROUNDS.includes(activeRound);
  const isMultiDance = dances.length > 1;
  const isProficiency = event.scoringType === 'proficiency';
  const hasSkatingDetail = results.some(r => r.skatingDetail);
  const rounds = event.heats.map(h => h.round);

  return (
    <div className="py-2">
      {rounds.length > 1 && (
        <div className="flex gap-2 mb-3">
          {rounds.map((r) => (
            <button
              key={r}
              onClick={() => fetchRound(r)}
              className={`px-3 py-1 rounded border text-xs capitalize cursor-pointer transition-colors ${
                r === activeRound
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {r.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <div className="text-gray-400 text-sm">No scores submitted yet for this round.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {judges.length > 0 && (
            isMultiDance ? (
              dances.map(dance => (
                <div key={dance}>
                  <h4 className="text-sm font-semibold mb-1 capitalize">{dance}</h4>
                  <JudgeGrid results={results} judges={judges} isRecall={isRecall} dance={dance} />
                </div>
              ))
            ) : (
              <div>
                <h4 className="text-sm font-semibold mb-1">
                  {isRecall ? 'Recall Marks' : 'Judge Placements'}
                </h4>
                <JudgeGrid results={results} judges={judges} isRecall={isRecall} />
              </div>
            )
          )}

          {!isRecall && !isProficiency && hasSkatingDetail && !isMultiDance && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Skating System Breakdown</h4>
              <SkatingBreakdown results={results} numJudges={judges.length} />
            </div>
          )}

          {!isRecall && !isProficiency && isMultiDance && results.some(r => r.danceDetails?.some(d => d.skatingDetail)) && (
            dances.map(dance => {
              const danceResults = results.map(r => {
                const dd = r.danceDetails?.find(d => d.dance === dance);
                if (!dd?.skatingDetail) return null;
                return { ...r, skatingDetail: dd.skatingDetail, place: dd.placement };
              }).filter(Boolean) as typeof results;
              if (danceResults.length === 0) return null;
              return (
                <div key={`skating-${dance}`}>
                  <h4 className="text-sm font-semibold mb-1 capitalize">Skating: {dance}</h4>
                  <SkatingBreakdown results={danceResults} numJudges={judges.length} />
                </div>
              );
            })
          )}

          {isMultiDance && !isRecall && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Overall Placement</h4>
              <MultiDanceSummary results={results} dances={dances} />
            </div>
          )}

          {isProficiency && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Proficiency Scores</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left px-2 py-1.5">Bib</th>
                    <th className="text-left px-2 py-1.5">Couple</th>
                    <th className="text-right px-2 py-1.5">Avg Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.bib} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-2 py-1.5">{r.bib}</td>
                      <td className="px-2 py-1.5">{r.leaderName} &amp; {r.followerName}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{r.totalScore?.toFixed(1) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── By-Event tab: expandable event cards ── */
function ByEventTab({ competitionId }: { competitionId: number }) {
  const [events, setEvents] = useState<Record<number, Event>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  useEffect(() => {
    eventsApi.getAll(competitionId)
      .then((r) => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  const eventList = useMemo(() => {
    const list = Object.values(events);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(e => e.name.toLowerCase().includes(q));
  }, [events, search]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event name..."
          className="w-full max-w-[400px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>
      {eventList.length === 0 ? (
        <p className="text-gray-400">{search.trim() ? 'No events match that search.' : 'No events for this competition.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {eventList.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            const rounds = evt.heats.map(h => h.round);
            return (
              <div key={evt.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                  className="px-4 py-3 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{evt.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[evt.style, evt.level].filter(Boolean).join(' \u00b7 ')}
                      {evt.heats.length > 0 && <> &middot; {evt.heats.length} round{evt.heats.length !== 1 ? 's' : ''}</>}
                    </div>
                  </div>
                  <span className="text-gray-400 text-lg">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                </div>
                {isExpanded && rounds.length > 0 && (
                  <div className="border-t border-gray-200 px-4">
                    <AdminEventResultsDetail eventId={evt.id} rounds={rounds} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── Per-person data built from people + couples ── */
interface PersonWithPartnerships {
  id: number;
  firstName: string;
  lastName: string;
  partnerships: Array<{ bib: number; coupleId: number; partnerName: string }>;
}

/* ── By-Person tab: people with expandable partnerships/events ── */
function ByPersonTab({ competitionId }: { competitionId: number }) {
  const [people, setPeople] = useState<PersonWithPartnerships[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      peopleApi.getAll(competitionId),
      couplesApi.getAll(competitionId),
    ])
      .then(([peopleRes, couplesRes]) => {
        const couples = couplesRes.data;
        // Build person → partnerships map
        const personPartnerships = new Map<number, Array<{ bib: number; coupleId: number; partnerName: string }>>();
        for (const c of couples) {
          let leaderList = personPartnerships.get(c.leaderId);
          if (!leaderList) { leaderList = []; personPartnerships.set(c.leaderId, leaderList); }
          leaderList.push({ bib: c.bib, coupleId: c.id, partnerName: c.followerName });
          let followerList = personPartnerships.get(c.followerId);
          if (!followerList) { followerList = []; personPartnerships.set(c.followerId, followerList); }
          followerList.push({ bib: c.bib, coupleId: c.id, partnerName: c.leaderName });
        }
        setPeople(peopleRes.data.map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          partnerships: personPartnerships.get(p.id) || [],
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  const filtered = useMemo(() => {
    const sorted = [...people].sort((a, b) =>
      a.lastName.toLowerCase().localeCompare(b.lastName.toLowerCase())
    );
    if (!search.trim()) return sorted;
    const q = search.trim().toLowerCase();
    return sorted.filter(p =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.partnerships.some(pt => String(pt.bib).includes(q))
    );
  }, [people, search]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by dancer name..."
          className="w-full max-w-[400px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-gray-400">{search.trim() ? 'No dancers match that search.' : 'No dancers in this competition.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((person) => (
            <PersonResultCard
              key={person.id}
              personName={`${person.firstName} ${person.lastName}`}
              linkTo={`/results/${competitionId}/person/${person.id}`}
              partnerships={person.partnerships}
              loadPartnerships={async () => {
                // Load events for each of this person's bibs
                const results: PartnershipEvents[] = [];
                for (const pt of person.partnerships) {
                  const res = await couplesApi.getEvents(pt.coupleId);
                  const events = res.data.map(e => ({
                    id: e.id,
                    name: e.name,
                    style: e.style,
                    level: e.level,
                    rounds: e.heats.map(h => h.round),
                  }));
                  if (events.length > 0) {
                    results.push({ bib: pt.bib, partnerName: pt.partnerName, events });
                  }
                }
                return results;
              }}
              renderEventResults={(eventId, rounds) => (
                <AdminEventResultsDetail eventId={eventId} rounds={rounds} />
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ── Main page ── */
const CompetitionResultsPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const [activeView, setActiveView] = useState<'person' | 'event'>('person');

  const tabClass = (tab: 'person' | 'event') =>
    `px-4 py-2 text-sm font-medium rounded-t border-b-2 cursor-pointer transition-colors ${
      activeView === tab
        ? 'border-primary-500 text-primary-500 bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Results</h2>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button onClick={() => setActiveView('person')} className={tabClass('person')}>
          By Person
        </button>
        <button onClick={() => setActiveView('event')} className={tabClass('event')}>
          By Event
        </button>
      </div>

      {activeView === 'person' ? (
        <ByPersonTab competitionId={competitionId} />
      ) : (
        <ByEventTab competitionId={competitionId} />
      )}
    </div>
  );
};

export default CompetitionResultsPage;
