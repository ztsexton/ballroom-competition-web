import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../../api/client';
import { Event, DetailedResultsResponse } from '../../types';
import { JudgeGrid } from '../../components/results/JudgeGrid';
import { SkatingBreakdown } from '../../components/results/SkatingBreakdown';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';
import { Skeleton } from '../../components/Skeleton';

const RECALL_ROUNDS = ['quarter-final', 'semi-final'];

interface SectionResult {
  bib: number;
  leaderName: string;
  followerName: string;
  sectionLetter: string;
  eventId: number;
  scores: number[];
  averageScore: number;
  combinedRank: number;
}

interface SectionResultsData {
  sectionGroupId: string;
  eventName: string;
  sectionCount: number;
  results: SectionResult[];
}

const ResultsPage = () => {
  const { id, round } = useParams<{ id: string; round?: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [detailed, setDetailed] = useState<DetailedResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState<string>('final');
  const [sectionResults, setSectionResults] = useState<SectionResultsData | null>(null);
  const [showCombined, setShowCombined] = useState(false);

  useEffect(() => {
    if (id) {
      loadEventAndResults();
    }
  }, [id, round]);

  const loadEventAndResults = async () => {
    try {
      const eventResponse = await eventsApi.getById(parseInt(id!));
      setEvent(eventResponse.data);

      const roundToUse = round || eventResponse.data.heats[0]?.round || 'final';
      setCurrentRound(roundToUse);

      const detailResponse = await eventsApi.getDetailedResults(parseInt(id!), roundToUse);
      setDetailed(detailResponse.data);

      // Load combined section results if this is a section event
      if (eventResponse.data.sectionGroupId) {
        try {
          const sectionRes = await eventsApi.getSectionResults(
            eventResponse.data.competitionId,
            eventResponse.data.sectionGroupId,
          );
          setSectionResults(sectionRes.data);
        } catch {
          // Section results are optional — don't fail the page
        }
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">Event not found</p>
        </div>
      </div>
    );
  }

  const results = detailed?.results || [];
  const judges = detailed?.judges || [];
  const dances = detailed?.dances || [];
  const isRecall = RECALL_ROUNDS.includes(currentRound);
  const isMultiDance = dances.length > 1;
  const isProficiency = event.scoringType === 'proficiency';
  const hasSkatingDetail = results.some(r => r.skatingDetail);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Results: {event.name}</h2>
            {(detailed?.style || detailed?.level) && (
              <div className="text-sm text-gray-500 mt-1">
                {[detailed.style, detailed.level].filter(Boolean).join(' \u00b7 ')}
                {isMultiDance && <> &middot; {dances.join(', ')}</>}
              </div>
            )}
          </div>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200">Back</button>
        </div>

        {event.heats.length > 1 && (
          <div className="mb-4">
            <label className="mr-2 font-medium">Round:</label>
            {event.heats.map(heat => (
              <button
                key={heat.round}
                onClick={() => navigate(`/events/${id}/results/${heat.round}`)}
                className={`mr-2 px-4 py-2 rounded border-none cursor-pointer text-sm font-medium transition-colors capitalize ${
                  heat.round === currentRound
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {heat.round}
              </button>
            ))}
          </div>
        )}

        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No scores submitted yet for this round</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Judge Grid(s) */}
            {judges.length > 0 && (
              isMultiDance ? (
                dances.map(dance => (
                  <div key={dance}>
                    <h3 className="text-base font-semibold mb-2 capitalize">{dance}</h3>
                    <JudgeGrid results={results} judges={judges} isRecall={isRecall} dance={dance} />
                  </div>
                ))
              ) : (
                <div>
                  <h3 className="text-base font-semibold mb-2">
                    {isRecall ? 'Recall Marks' : 'Judge Placements'}
                  </h3>
                  <JudgeGrid results={results} judges={judges} isRecall={isRecall} />
                </div>
              )
            )}

            {/* Skating Breakdown for single-dance finals */}
            {!isRecall && !isProficiency && hasSkatingDetail && !isMultiDance && (
              <div>
                <h3 className="text-base font-semibold mb-2">Skating System Breakdown</h3>
                <SkatingBreakdown results={results} numJudges={judges.length} />
              </div>
            )}

            {/* Per-dance skating breakdown for multi-dance finals */}
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
                    <h3 className="text-base font-semibold mb-2 capitalize">Skating: {dance}</h3>
                    <SkatingBreakdown results={danceResults} numJudges={judges.length} />
                  </div>
                );
              })
            )}

            {/* Multi-dance summary table */}
            {isMultiDance && !isRecall && (
              <div>
                <h3 className="text-base font-semibold mb-2">Overall Placement</h3>
                <MultiDanceSummary results={results} dances={dances} />
              </div>
            )}

            {/* Proficiency scoring summary */}
            {isProficiency && (
              <div>
                <h3 className="text-base font-semibold mb-2">Proficiency Scores</h3>
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
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {r.totalScore?.toFixed(1) ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Combined Section Results */}
        {sectionResults && sectionResults.sectionCount > 1 && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowCombined(!showCombined)}
              className="text-sm font-semibold text-primary-600 hover:text-primary-800 bg-transparent border-none cursor-pointer"
            >
              {showCombined ? '\u25bc' : '\u25b6'} Combined Section Results ({sectionResults.sectionCount} sections)
            </button>
            {showCombined && (
              <div className="mt-3">
                <p className="text-sm text-gray-500 mb-2">
                  All couples ranked across {sectionResults.sectionCount} sections of {sectionResults.eventName}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left px-2 py-1.5">Rank</th>
                      <th className="text-left px-2 py-1.5">Bib</th>
                      <th className="text-left px-2 py-1.5">Couple</th>
                      <th className="text-center px-2 py-1.5">Section</th>
                      <th className="text-right px-2 py-1.5">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionResults.results.map((r, i) => (
                      <tr key={`${r.eventId}-${r.bib}`} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                        <td className="px-2 py-1.5 font-semibold">{r.combinedRank}</td>
                        <td className="px-2 py-1.5">{r.bib}</td>
                        <td className="px-2 py-1.5">{r.leaderName} &amp; {r.followerName}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{r.sectionLetter}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {r.averageScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage;
