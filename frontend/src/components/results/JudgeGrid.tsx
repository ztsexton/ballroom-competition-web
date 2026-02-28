import { EventResult } from '../../types';

interface JudgeInfo {
  id: number;
  judgeNumber: number;
  name: string;
}

interface JudgeGridProps {
  results: EventResult[];
  judges: JudgeInfo[];
  isRecall: boolean;
  dance?: string;
}

function getScoresForDance(result: EventResult, dance?: string): number[] {
  if (dance && result.danceDetails) {
    const dd = result.danceDetails.find(d => d.dance === dance);
    if (dd) return dd.scores;
  }
  return result.scores;
}

function getMetricForDance(result: EventResult, dance: string | undefined, isRecall: boolean): number | undefined {
  if (dance && result.danceDetails) {
    const dd = result.danceDetails.find(d => d.dance === dance);
    if (dd) return isRecall ? dd.totalMarks : dd.placement;
  }
  return isRecall ? result.totalMarks : result.place;
}

export function JudgeGrid({ results, judges, isRecall, dance }: JudgeGridProps) {
  if (results.length === 0 || judges.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Bib</th>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Couple</th>
            {judges.map(j => (
              <th key={j.id} className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap" title={j.name}>J{j.judgeNumber}</th>
            ))}
            <th className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">{isRecall ? 'Marks' : 'Place'}</th>
            {isRecall && <th className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Recalled</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => {
            const scores = getScoresForDance(r, dance);
            const metric = getMetricForDance(r, dance, isRecall);
            return (
              <tr
                key={r.bib}
                className={r.recalled ? 'bg-green-50' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
              >
                <td className="text-left px-2 py-1 text-sm border-b border-gray-100">{r.bib}</td>
                <td className="text-left px-2 py-1 text-sm border-b border-gray-100">{r.leaderName} &amp; {r.followerName}</td>
                {judges.map((j, ji) => (
                  <td key={j.id} className="text-center px-2 py-1 text-sm border-b border-gray-100">
                    {isRecall
                      ? (scores[ji] === 1 ? '\u2713' : '')
                      : (scores[ji] ?? '-')}
                  </td>
                ))}
                <td className="text-center px-2 py-1 text-sm border-b border-gray-100 font-semibold">{metric ?? '-'}</td>
                {isRecall && (
                  <td className={`text-center px-2 py-1 text-sm border-b border-gray-100 ${r.recalled ? 'text-green-800' : 'text-gray-400'}`}>
                    {r.recalled === true ? '\u2713' : r.recalled === false ? '' : '-'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
