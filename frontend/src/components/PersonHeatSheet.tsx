import { PersonHeatListResponse, PersonHeatEntry } from '../types';

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface PersonHeatSheetProps {
  data: PersonHeatListResponse;
  competitionName?: string;
}

export function PersonHeatSheet({ data, competitionName }: PersonHeatSheetProps) {
  return (
    <div>
      {/* Print header — only visible when printing */}
      {competitionName && (
        <div className="hidden print:block text-center mb-4">
          <p className="text-sm text-gray-500">{competitionName}</p>
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-1 text-center print:text-lg">
        <span className="block text-sm font-normal text-gray-500 mb-1">Heat Sheet for</span>
        {data.firstName} {data.lastName}
      </h2>

      {data.partnerships.length === 0 ? (
        <p className="text-gray-400 text-center mt-6">No heats found for this person.</p>
      ) : (
        <div className="mt-6 print:mt-3">
          {data.partnerships.map((partnership) => {
            const styleGroups: { style: string; heats: PersonHeatEntry[] }[] = [];
            for (const heat of partnership.heats) {
              const style = heat.style || 'Other';
              const group = styleGroups.find(g => g.style === style);
              if (group) {
                group.heats.push(heat);
              } else {
                styleGroups.push({ style, heats: [heat] });
              }
            }

            return (
              <div key={partnership.bib} className="mb-8 print:mb-4">
                <h3 className="text-base font-semibold text-primary-500 mb-2 ml-1 print:text-sm print:text-black">
                  With {partnership.partnerName}
                  <span className="text-gray-400 font-normal ml-2 text-sm">Bib #{partnership.bib}</span>
                </h3>
                {styleGroups.map((group) => (
                  <div key={group.style} className="mb-4 print:mb-2">
                    <h4 className="text-sm font-semibold text-gray-600 mb-1 ml-1">{group.style}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse bg-white border border-gray-300 print:text-xs">
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500 print:text-xs print:px-2 print:py-1 print:bg-gray-700">
                              Time
                            </th>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500 print:text-xs print:px-2 print:py-1 print:bg-gray-700">
                              Heat
                            </th>
                            <th className="text-left px-3 py-2 text-sm font-semibold text-white bg-gray-500 border border-gray-500 print:text-xs print:px-2 print:py-1 print:bg-gray-700">
                              Event
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.heats.map((heat, idx) => (
                            <tr
                              key={`${heat.heatNumber}-${heat.eventName}-${idx}`}
                              className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                            >
                              <td className="px-3 py-2 text-sm border border-gray-300 whitespace-nowrap print:text-xs print:px-2 print:py-1">
                                {formatTime(heat.estimatedTime)}
                              </td>
                              <td className="px-3 py-2 text-sm border border-gray-300 whitespace-nowrap print:text-xs print:px-2 print:py-1">
                                {heat.heatNumber}
                              </td>
                              <td className="px-3 py-2 text-sm border border-gray-300 print:text-xs print:px-2 print:py-1">
                                {heat.eventName}
                                {heat.dance && (
                                  <span className="text-gray-400 ml-1">({heat.dance})</span>
                                )}
                                {heat.round !== 'final' && (
                                  <span className="text-xs text-gray-400 ml-1 capitalize print:text-[10px]">
                                    [{heat.round.replace('-', ' ')}]
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
