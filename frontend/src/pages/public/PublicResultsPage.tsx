import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { PublicCompetition, PublicEvent, PublicEventSearchResult, DetailedResultsResponse, Person } from '../../types';
import { publicCompetitionsApi, participantApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { MultiDanceSummary } from '../../components/results/MultiDanceSummary';
import { PersonResultCard, PartnershipEvents } from '../../components/results/PersonResultCard';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { Skeleton } from '../../components/Skeleton';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Competition list view (/results) ── */
function CompetitionList() {
  const [competitions, setCompetitions] = useState<PublicCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicCompetitionsApi.getAll()
      .then((r) => setCompetitions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-7 w-56 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Competition Results</h2>
      {competitions.length === 0 ? (
        <p className="text-gray-400">No competitions found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {competitions.map((c) => (
            <Link key={c.id} to={`/results/${c.id}`} className="no-underline text-inherit">
              <div className="bg-white rounded-lg shadow px-5 py-4 cursor-pointer transition-shadow hover:shadow-md">
                <div className="font-semibold text-gray-800">{c.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {formatDate(c.date)}
                  {c.location && <> &middot; {c.location}</>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const RECALL_ROUNDS = ['quarter-final', 'semi-final'];

/* ── Event results table (inline expand) ── */
function EventResultsTable({ competitionId, eventId, rounds }: {
  competitionId: number;
  eventId: number;
  rounds: string[];
}) {
  const [activeRound, setActiveRound] = useState(rounds[rounds.length - 1] || 'final');
  const [detailed, setDetailed] = useState<DetailedResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback((round: string) => {
    setLoading(true);
    publicCompetitionsApi.getDetailedEventResults(competitionId, eventId, round)
      .then((r) => setDetailed(r.data))
      .catch(() => setDetailed(null))
      .finally(() => setLoading(false));
  }, [competitionId, eventId]);

  useEffect(() => { fetchResults(activeRound); }, [activeRound, fetchResults]);

  const results = detailed?.results || [];
  const dances = detailed?.dances || [];
  const isMultiDance = dances.length > 1;
  const isRecall = RECALL_ROUNDS.includes(activeRound);

  return (
    <div className="py-3">
      {/* Round tabs */}
      {rounds.length > 1 && (
        <div className="flex gap-2 mb-3">
          {rounds.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
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

      {loading ? (
        <Skeleton variant="table" rows={4} cols={5} />
      ) : results.length === 0 ? (
        <div className="text-gray-400 text-sm">No results available for this round.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {isMultiDance && !isRecall && (
            <MultiDanceSummary results={results} dances={dances} />
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
                  {results.map((r, i) => (
                    <tr
                      key={r.bib}
                      className={`border-b border-gray-100 ${r.recalled ? 'bg-green-50' : i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}
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

/* ── Public person type from the people endpoint ── */
interface PublicPerson {
  id: number;
  firstName: string;
  lastName: string;
  partnerships: Array<{ bib: number; partnerName: string }>;
}

/* ── By-Person tab for public results ── */
function PublicByPersonTab({ competitionId }: { competitionId: number }) {
  const [search, setSearch] = useState('');
  const [allPeople, setAllPeople] = useState<PublicPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicCompetitionsApi.getPeople(competitionId)
      .then((r) => setAllPeople(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  const filtered = useMemo(() => {
    const sorted = [...allPeople].sort((a, b) =>
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
  }, [allPeople, search]);

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
                // Search by last name to find all events this person is in
                const res = await publicCompetitionsApi.searchByDancer(competitionId, person.lastName);
                // Group events by bib/partnership
                return person.partnerships.map(pt => {
                  const events: PartnershipEvents['events'] = [];
                  for (const evt of res.data) {
                    if (evt.matchingCouples.some(mc => mc.bib === pt.bib)) {
                      events.push({
                        id: evt.id,
                        name: evt.name,
                        style: evt.style,
                        level: evt.level,
                        rounds: evt.rounds,
                      });
                    }
                  }
                  return { bib: pt.bib, partnerName: pt.partnerName, events };
                }).filter(pt => pt.events.length > 0);
              }}
              renderEventResults={(eventId, rounds) => (
                <EventResultsTable competitionId={competitionId} eventId={eventId} rounds={rounds} />
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ── By-Event tab for public results (original behavior) ── */
function PublicByEventTab({ competitionId }: { competitionId: number }) {
  const [events, setEvents] = useState<(PublicEvent | PublicEventSearchResult)[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allEvents, setAllEvents] = useState<PublicEvent[]>([]);

  useEffect(() => {
    publicCompetitionsApi.getEvents(competitionId)
      .then((r) => { setEvents(r.data); setAllEvents(r.data); })
      .catch(() => {});
  }, [competitionId]);

  useEffect(() => {
    if (!search.trim()) {
      setEvents(allEvents);
      return;
    }
    const q = search.trim().toLowerCase();
    // First filter by event name locally
    const nameMatches = allEvents.filter(e => e.name.toLowerCase().includes(q));
    if (nameMatches.length > 0) {
      setEvents(nameMatches);
      return;
    }
    // Fall back to server-side dancer name search
    const timeout = setTimeout(() => {
      setIsSearching(true);
      publicCompetitionsApi.searchByDancer(competitionId, search.trim())
        .then((r) => setEvents(r.data))
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, competitionId, allEvents]);

  return (
    <>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event name or dancer..."
          className="w-full max-w-[400px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        {isSearching && <span className="ml-2 text-gray-400 text-xs">Searching...</span>}
      </div>

      {events.length === 0 ? (
        <p className="text-gray-400">
          {search.trim() ? 'No events match that search.' : 'No events for this competition.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            const searchResult = 'matchingCouples' in evt ? evt as PublicEventSearchResult : null;
            return (
              <div key={evt.id} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                  aria-expanded={isExpanded}
                  className="w-full text-left px-4 py-3 cursor-pointer flex justify-between items-center transition-colors hover:bg-gray-50 bg-transparent border-none"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{evt.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[evt.style, evt.level].filter(Boolean).join(' \u00b7 ')}
                      {evt.coupleCount > 0 && <> &middot; {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}</>}
                      {evt.rounds.length > 0 && <> &middot; {evt.rounds.length} round{evt.rounds.length !== 1 ? 's' : ''}</>}
                    </div>
                    {searchResult && searchResult.matchingCouples.length > 0 && (
                      <div className="text-xs text-primary-500 mt-1">
                        {searchResult.matchingCouples.map(
                          (mc) => `#${mc.bib} ${mc.leaderName} & ${mc.followerName}`
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400 text-lg">
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>
                </button>

                {isExpanded && evt.rounds.length > 0 && (
                  <div className="border-t border-gray-200 px-4">
                    <EventResultsTable
                      competitionId={competitionId}
                      eventId={evt.id}
                      rounds={evt.rounds}
                    />
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

/* ── Competition detail view (/results/:competitionId or /competition/:competitionId) ── */
function CompetitionDetail({ competitionId }: { competitionId: number }) {
  const [competition, setCompetition] = useState<PublicCompetition | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const isCompetitionRoute = location.pathname.startsWith('/competition/');
  const [myPerson, setMyPerson] = useState<Person | null>(null);
  const [activeView, setActiveView] = useState<'person' | 'event'>('person');

  useEffect(() => {
    publicCompetitionsApi.getById(competitionId)
      .then(c => setCompetition(c.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [competitionId]);

  useEffect(() => {
    if (!user) {
      setMyPerson(null);
      return;
    }
    participantApi.getMyEntries(competitionId)
      .then(res => setMyPerson(res.data.person))
      .catch(() => setMyPerson(null));
  }, [user, competitionId]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton variant="card" className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      </div>
    );
  }

  if (!competition) return <div className="text-center text-danger-500">Competition not found.</div>;

  const btnBase = 'inline-block px-4 py-2 text-white rounded-md no-underline text-sm font-semibold transition-colors';

  const tabClass = (tab: 'person' | 'event') =>
    `px-4 py-2 text-sm font-medium rounded-t border-b-2 cursor-pointer transition-colors ${
      activeView === tab
        ? 'border-primary-500 text-primary-500 bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <>
      <Link to={isCompetitionRoute ? '/' : '/results'} className="text-primary-500 text-sm hover:underline">
        &larr; {isCompetitionRoute ? 'Home' : 'All competitions'}
      </Link>
      <div className="bg-white rounded-lg shadow p-6 mt-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800 mb-2">{competition.name}</h2>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <CompetitionTypeBadge type={competition.type} />
        </div>
        <div className="text-sm text-gray-600 mb-3">
          {formatDate(competition.date)}
          {competition.location && <> &middot; {competition.location}</>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap items-center mb-3">
          {competition.registrationOpen ? (
            !user ? (
              <Link to={`/login?redirectTo=${encodeURIComponent(`/portal?competitionId=${competitionId}`)}`} className={`${btnBase} bg-primary-500 hover:bg-primary-600`}>
                Sign in to Register
              </Link>
            ) : myPerson ? (
              <>
                <span className="px-3 py-2 bg-green-50 text-green-800 border border-green-200 rounded-md text-sm font-medium">
                  Registered as {myPerson.firstName} {myPerson.lastName}
                </span>
                <Link to={`/portal?competitionId=${competitionId}`} className={`${btnBase} bg-primary-500 hover:bg-primary-600`}>
                  Manage Entries
                </Link>
              </>
            ) : (
              <Link to={`/portal?competitionId=${competitionId}`} className={`${btnBase} bg-primary-500 hover:bg-primary-600`}>
                Register
              </Link>
            )
          ) : (
            <span className="text-sm text-gray-400">Registration closed</span>
          )}
          <Link to={`/pay/${competitionId}`} className={`${btnBase} bg-success-500 hover:bg-success-600`}>
            Pay
          </Link>
          <Link to={`/results/${competitionId}/heatlists`} className={`${btnBase} bg-orange-500 hover:bg-orange-600`}>
            Heatlists
          </Link>
          <Link to={`/results/${competitionId}/heats`} className={`${btnBase} bg-gray-500 hover:bg-gray-600`}>
            Program
          </Link>
          {isCompetitionRoute && (
            <Link to={`/results/${competitionId}`} className={`${btnBase} bg-purple-500 hover:bg-purple-600`}>
              Results
            </Link>
          )}
          {isAdmin && (
            <Link to={`/competitions/${competitionId}`} className={`${btnBase} bg-gray-600 hover:bg-gray-700`}>
              Manage Competition
            </Link>
          )}
        </div>

        {competition.description && (
          <p className="text-gray-500 text-sm mt-2">{competition.description}</p>
        )}
        {(competition.websiteUrl || competition.organizerEmail) && (
          <div className="flex gap-4 text-sm mt-2">
            {competition.websiteUrl && (
              <a href={competition.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
                Visit Website
              </a>
            )}
            {competition.organizerEmail && (
              <a href={`mailto:${competition.organizerEmail}`} className="text-primary-500 hover:underline">
                Contact Organizer
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tabbed results only on /results/:id */}
      {!isCompetitionRoute && (
        <>
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            <button onClick={() => setActiveView('person')} className={tabClass('person')}>
              By Person
            </button>
            <button onClick={() => setActiveView('event')} className={tabClass('event')}>
              By Event
            </button>
          </div>

          {activeView === 'person' ? (
            <PublicByPersonTab competitionId={competitionId} />
          ) : (
            <PublicByEventTab competitionId={competitionId} />
          )}
        </>
      )}
    </>
  );
}

/* ── Main component ── */
const PublicResultsPage = () => {
  const { competitionId } = useParams<{ competitionId?: string }>();

  return (
    <div className="max-w-7xl mx-auto px-8 pt-6 pb-12">
      {competitionId ? (
        <CompetitionDetail competitionId={Number(competitionId)} />
      ) : (
        <CompetitionList />
      )}
    </div>
  );
};

export default PublicResultsPage;
