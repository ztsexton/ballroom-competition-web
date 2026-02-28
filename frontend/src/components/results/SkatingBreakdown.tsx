import { EventResult } from '../../types';

interface SkatingBreakdownProps {
  results: EventResult[];
  numJudges: number;
}

export function SkatingBreakdown({ results, numJudges }: SkatingBreakdownProps) {
  const finalists = results.filter(r => r.skatingDetail);
  if (finalists.length === 0) return null;

  const majority = Math.floor(numJudges / 2) + 1;
  const numCouples = finalists.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Bib</th>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Couple</th>
            {Array.from({ length: numCouples }, (_, i) => (
              <th key={i} className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">1{i > 0 ? `\u2013${i + 1}` : ''}</th>
            ))}
            <th className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Result</th>
          </tr>
        </thead>
        <tbody>
          {finalists.map((r, idx) => {
            const sd = r.skatingDetail!;
            return (
              <tr key={r.bib} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="text-left px-2 py-1 text-xs border-b border-gray-100">{r.bib}</td>
                <td className="text-left px-2 py-1 text-xs border-b border-gray-100">{r.leaderName} &amp; {r.followerName}</td>
                {sd.cumulativeCounts.map((count, i) => {
                  const sum = sd.cumulativeSums[i];
                  const hasMajority = count >= majority;
                  return (
                    <td
                      key={i}
                      className={`text-center px-2 py-1 text-xs border-b border-gray-100 ${hasMajority ? 'font-semibold bg-blue-50' : ''}`}
                    >
                      {hasMajority ? `${count}(${sum})` : count || ''}
                    </td>
                  );
                })}
                <td className="text-center px-2 py-1 text-xs border-b border-gray-100 font-bold">{r.place ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
