import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PersonResultsResponse, PersonEventResult } from '../../types';
import { publicCompetitionsApi } from '../../api/client';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';
import { Skeleton } from '../../components/Skeleton';

const RECALL_ROUNDS = ['quarter-final', 'semi-final'];

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function EventRoundResults({ eventResult, highlightBib }: {
  eventResult: PersonEventResult;
  highlightBib: number;
}) {
  const [activeRound, setActiveRound] = useState(
    eventResult.rounds[eventResult.rounds.length - 1]?.round || 'final'
  );

  const roundData = eventResult.rounds.find(r => r.round === activeRound);
  if (!roundData) return null;

  const { detailed } = roundData;
  const results = detailed.results;
  const dances = detailed.dances || [];
  const isMultiDance = dances.length > 1;
  const isRecall = RECALL_ROUNDS.includes(activeRound);

  return (
    <div className="py-2">
      {eventResult.rounds.length > 1 && (
        <div className="flex gap-2 mb-3">
          {eventResult.rounds.map((r) => (
            <button
              key={r.round}
              onClick={() => setActiveRound(r.round)}
              className={`px-3 py-1 rounded border text-xs capitalize cursor-pointer transition-colors ${
                r.round === activeRound
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {r.round.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <div className="text-gray-400 text-sm">No results available for this round.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {isMultiDance && !isRecall && (
            <div className="overflow-x-auto">
              <MultiDanceSummary results={results} dances={dances} highlightBib={highlightBib} />
            </div>
          )}

          {(!isMultiDance || isRecall) && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600">
                      {isRecall ? '#' : 'Place'}
                    </th>
                    <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600">Bib</th>
                    <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600">Leader</th>
                    <th className="text-left px-2 py-1.5 text-xs font-semibold text-gray-600">Follower</th>
                    <th className="text-right px-2 py-1.5 text-xs font-semibold text-gray-600">
                      {isRecall ? 'Marks' : 'Result'}
                    </th>
                    {isRecall && (
                      <th className="text-center px-2 py-1.5 text-xs font-semibold text-gray-600">Recalled</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const isHighlighted = r.bib === highlightBib;
                    return (
                      <tr
                        key={r.bib}
                        className={`border-b border-gray-100 ${
                          isHighlighted
                            ? 'bg-primary-50 font-semibold'
                            : r.recalled
                              ? 'bg-green-50'
                              : i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                        }`}
                      >
                        <td className="px-2 py-1.5">{isRecall ? i + 1 : (r.place ?? '-')}</td>
                        <td className="px-2 py-1.5">{r.bib}</td>
                        <td className="px-2 py-1.5">{r.leaderName}</td>
                        <td className="px-2 py-1.5">{r.followerName}</td>
                        <td className="px-2 py-1.5 text-right">
                          {isRecall ? (r.totalMarks ?? '-') : (r.place ?? r.totalScore?.toFixed(1) ?? '-')}
                        </td>
                        {isRecall && (
                          <td className={`px-2 py-1.5 text-center ${r.recalled ? 'text-green-700' : 'text-gray-400'}`}>
                            {r.recalled === true ? '\u2713' : ''}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PublicPersonResultsPage = () => {
  const { competitionId, personId } = useParams<{ competitionId: string; personId: string }>();
  const [data, setData] = useState<PersonResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!competitionId || !personId) return;
    setLoading(true);
    publicCompetitionsApi.getPersonResults(Number(competitionId), Number(personId))
      .then((r) => setData(r.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load results');
      })
      .finally(() => setLoading(false));
  }, [competitionId, personId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
        <Link to={`/results/${competitionId}`} className="text-primary-500 text-sm hover:underline">
          &larr; Back to results
        </Link>
        <div className="text-center text-danger-500 mt-8">{error || 'Person not found.'}</div>
      </div>
    );
  }

  // Group events by partnership (bib + partnerName)
  const partnershipMap = new Map<number, { partnerName: string; events: PersonEventResult[] }>();
  for (const evt of data.events) {
    let group = partnershipMap.get(evt.bib);
    if (!group) {
      group = { partnerName: evt.partnerName, events: [] };
      partnershipMap.set(evt.bib, group);
    }
    group.events.push(evt);
  }

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
      <Link to={`/results/${competitionId}`} className="text-primary-500 text-sm hover:underline">
        &larr; Back to results
      </Link>

      <h2 className="text-xl font-bold text-gray-800 mt-3 mb-6">
        {data.firstName} {data.lastName}
      </h2>

      {data.events.length === 0 ? (
        <p className="text-gray-400">No results found for this person.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...partnershipMap.entries()].map(([bib, group]) => (
            <div key={bib}>
              <div className="text-sm font-medium text-gray-500 mb-2">
                w/ {group.partnerName}
                <span className="text-gray-400 ml-1">#{bib}</span>
                <span className="text-gray-400 ml-2">
                  &middot; {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {group.events.map((evt) => (
                  <EventCard key={evt.eventId} eventResult={evt} highlightBib={bib} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function EventCard({ eventResult, highlightBib }: { eventResult: PersonEventResult; highlightBib: number }) {
  const [expanded, setExpanded] = useState(true);

  // Get the person's final result summary
  const finalRound = eventResult.rounds[eventResult.rounds.length - 1];
  const personResult = finalRound?.personResult;
  const place = personResult?.place;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50 bg-transparent border-none"
      >
        <div>
          <div className="font-semibold text-gray-800">{eventResult.eventName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {[eventResult.style, eventResult.level].filter(Boolean).join(' \u00b7 ')}
            {eventResult.rounds.length > 0 && (
              <> &middot; {eventResult.rounds.length} round{eventResult.rounds.length !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {place != null && (
            <span className={`text-sm font-bold ${place <= 3 ? 'text-primary-500' : 'text-gray-600'}`}>
              {getOrdinal(place)}
            </span>
          )}
          <span className="text-gray-400 text-lg">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4">
          <EventRoundResults eventResult={eventResult} highlightBib={highlightBib} />
        </div>
      )}
    </div>
  );
}

export default PublicPersonResultsPage;
