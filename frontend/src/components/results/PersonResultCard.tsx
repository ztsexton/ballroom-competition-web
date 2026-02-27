import { useState, ReactNode } from 'react';

export interface PartnershipEvents {
  bib: number;
  partnerName: string;
  events: Array<{ id: number; name: string; style?: string; level?: string; rounds: string[] }>;
}

interface PersonResultCardProps {
  personName: string;
  partnerships: Array<{ bib: number; partnerName: string }>;
  renderEventResults: (eventId: number, rounds: string[]) => ReactNode;
  /** Lazy-load events for all partnerships when first expanded */
  loadPartnerships?: () => Promise<PartnershipEvents[]>;
}

export function PersonResultCard({
  personName,
  partnerships,
  renderEventResults,
  loadPartnerships,
}: PersonResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);
  const [partnershipData, setPartnershipData] = useState<PartnershipEvents[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleToggle = async () => {
    if (!expanded && loadPartnerships && !loaded) {
      setExpanded(true);
      setLoading(true);
      try {
        const data = await loadPartnerships();
        setPartnershipData(data);
        setLoaded(true);
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    } else {
      setExpanded(!expanded);
    }
  };

  const totalEvents = partnershipData.reduce((sum, p) => sum + p.events.length, 0);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div
        onClick={handleToggle}
        className="px-4 py-3 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50"
      >
        <div>
          <div className="font-semibold text-gray-800">{personName}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {partnerships.length > 0
              ? `${partnerships.length} partner${partnerships.length !== 1 ? 's' : ''}`
              : 'No partnerships'}
            {loaded && totalEvents > 0 && (
              <> &middot; {totalEvents} event{totalEvents !== 1 ? 's' : ''}</>
            )}
          </div>
        </div>
        <span className="text-gray-400 text-lg">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Loading events...</div>
          ) : partnershipData.length === 0 && loaded ? (
            <div className="px-4 py-3 text-sm text-gray-400">No events found.</div>
          ) : (
            <div className="flex flex-col">
              {partnershipData.map((partnership) => (
                <div key={partnership.bib}>
                  {/* Partnership header */}
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      w/ {partnership.partnerName}
                      <span className="text-gray-400 ml-1">#{partnership.bib}</span>
                      <span className="text-gray-400 ml-2">
                        &middot; {partnership.events.length} event{partnership.events.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                  {/* Events under this partnership */}
                  {partnership.events.map((evt) => {
                    const eventKey = `${partnership.bib}-${evt.id}`;
                    const isEventExpanded = expandedEventKey === eventKey;
                    return (
                      <div key={eventKey} className="border-b border-gray-100 last:border-b-0">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedEventKey(isEventExpanded ? null : eventKey);
                          }}
                          className="px-6 py-2.5 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50"
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-700">{evt.name}</div>
                            <div className="text-xs text-gray-400">
                              {[evt.style, evt.level].filter(Boolean).join(' \u00b7 ')}
                              {evt.rounds.length > 0 && <> &middot; {evt.rounds.length} round{evt.rounds.length !== 1 ? 's' : ''}</>}
                            </div>
                          </div>
                          <span className="text-gray-300 text-sm">
                            {isEventExpanded ? '\u25B2' : '\u25BC'}
                          </span>
                        </div>
                        {isEventExpanded && evt.rounds.length > 0 && (
                          <div className="px-6 pb-3">
                            {renderEventResults(evt.id, evt.rounds)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
