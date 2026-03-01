import { EventResult } from '../../types';

interface MultiDanceSummaryProps {
  results: EventResult[];
  dances: string[];
  highlightBib?: number;
}

const DANCE_ABBREVIATIONS: Record<string, string> = {
  waltz: 'W',
  tango: 'T',
  foxtrot: 'F',
  'viennese waltz': 'VW',
  quickstep: 'Q',
  'cha cha': 'C',
  samba: 'S',
  rumba: 'R',
  'paso doble': 'P',
  jive: 'J',
  bolero: 'B',
  mambo: 'M',
  'east coast swing': 'EC',
  'west coast swing': 'WC',
};

function abbreviate(dance: string): string {
  return DANCE_ABBREVIATIONS[dance.toLowerCase()] || dance.substring(0, 2).toUpperCase();
}

export function MultiDanceSummary({ results, dances, highlightBib }: MultiDanceSummaryProps) {
  if (results.length === 0 || dances.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Bib</th>
            <th className="text-left px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Couple</th>
            {dances.map(d => (
              <th key={d} className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap" title={d}>{abbreviate(d)}</th>
            ))}
            <th className="text-center px-2 py-1.5 text-xs border-b-2 border-gray-200 whitespace-nowrap">Result</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => (
            <tr key={r.bib} className={r.bib === highlightBib ? 'bg-primary-50 font-semibold' : idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="text-left px-2 py-1 text-sm border-b border-gray-100">{r.bib}</td>
              <td className="text-left px-2 py-1 text-sm border-b border-gray-100">{r.leaderName} &amp; {r.followerName}</td>
              {dances.map((dance) => {
                const ds = r.danceScores?.find(s => s.dance === dance);
                return <td key={dance} className="text-center px-2 py-1 text-sm border-b border-gray-100">{ds?.placement ?? '-'}</td>;
              })}
              <td className="text-center px-2 py-1 text-sm border-b border-gray-100 font-bold">{r.place ?? r.totalRank ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
