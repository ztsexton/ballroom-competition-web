import { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { PublicCompetition, PublicEvent, PublicEventSearchResult, EventResult, Person } from '../../types';
import { publicCompetitionsApi, participantApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

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

  if (loading) return <div style={{ textAlign: 'center', color: '#718096' }}>Loading...</div>;

  return (
    <>
      <h2 style={{ marginBottom: '1rem' }}>Competition Results</h2>
      {competitions.length === 0 ? (
        <p style={{ color: '#a0aec0' }}>No competitions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {competitions.map((c) => (
            <Link key={c.id} to={`/results/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                className="card"
                style={{ padding: '1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseOver={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
                onMouseOut={(e) => (e.currentTarget.style.boxShadow = '')}
              >
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.25rem' }}>
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

/* ── Event results table (inline expand) ── */
function EventResultsTable({ competitionId, eventId, rounds }: {
  competitionId: number;
  eventId: number;
  rounds: string[];
}) {
  const [activeRound, setActiveRound] = useState(rounds[rounds.length - 1] || 'final');
  const [results, setResults] = useState<EventResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback((round: string) => {
    setLoading(true);
    publicCompetitionsApi.getEventResults(competitionId, eventId, round)
      .then((r) => setResults(r.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [competitionId, eventId]);

  useEffect(() => { fetchResults(activeRound); }, [activeRound, fetchResults]);

  return (
    <div style={{ padding: '0.75rem 0' }}>
      {/* Round tabs */}
      {rounds.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {rounds.map((r) => (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e0',
                background: r === activeRound ? '#667eea' : 'white',
                color: r === activeRound ? 'white' : '#4a5568',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textTransform: 'capitalize',
              }}
            >
              {r.replace('-', ' ')}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#a0aec0', fontSize: '0.875rem' }}>Loading results...</div>
      ) : results.length === 0 ? (
        <div style={{ color: '#a0aec0', fontSize: '0.875rem' }}>No results available for this round.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Place</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Bib</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Leader</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Follower</th>
              <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.bib} style={{ borderBottom: '1px solid #edf2f7', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '0.4rem 0.5rem' }}>{r.place ?? '-'}</td>
                <td style={{ padding: '0.4rem 0.5rem' }}>{r.bib}</td>
                <td style={{ padding: '0.4rem 0.5rem' }}>{r.leaderName}</td>
                <td style={{ padding: '0.4rem 0.5rem' }}>{r.followerName}</td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{r.score ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ── Competition detail view (/results/:competitionId or /competition/:competitionId) ── */
function CompetitionDetail({ competitionId }: { competitionId: number }) {
  const [competition, setCompetition] = useState<PublicCompetition | null>(null);
  const [events, setEvents] = useState<(PublicEvent | PublicEventSearchResult)[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const isCompetitionRoute = location.pathname.startsWith('/competition/');
  const [myPerson, setMyPerson] = useState<Person | null>(null);

  useEffect(() => {
    if (isCompetitionRoute) {
      // Competition info page — only load competition details
      publicCompetitionsApi.getById(competitionId)
        .then(c => setCompetition(c.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // Results page — load competition + events
      Promise.all([
        publicCompetitionsApi.getById(competitionId),
        publicCompetitionsApi.getEvents(competitionId),
      ])
        .then(([c, e]) => {
          setCompetition(c.data);
          setEvents(e.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [competitionId, isCompetitionRoute]);

  // Check registration status when logged in
  useEffect(() => {
    if (!user) {
      setMyPerson(null);
      return;
    }
    participantApi.getMyEntries(competitionId)
      .then(res => setMyPerson(res.data.person))
      .catch(() => setMyPerson(null));
  }, [user, competitionId]);

  // Debounced dancer search (only on results page)
  useEffect(() => {
    if (isCompetitionRoute) return;
    if (!search.trim()) {
      publicCompetitionsApi.getEvents(competitionId)
        .then((r) => setEvents(r.data))
        .catch(() => {});
      return;
    }
    const timeout = setTimeout(() => {
      setIsSearching(true);
      publicCompetitionsApi.searchByDancer(competitionId, search.trim())
        .then((r) => setEvents(r.data))
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, competitionId, isCompetitionRoute]);

  if (loading) return <div style={{ textAlign: 'center', color: '#718096' }}>Loading...</div>;
  if (!competition) return <div style={{ textAlign: 'center', color: '#e53e3e' }}>Competition not found.</div>;

  const typeBadgeColors: Record<string, { bg: string; fg: string }> = {
    NDCA: { bg: '#e9d8fd', fg: '#553c9a' },
    USA_DANCE: { bg: '#bee3f8', fg: '#2a4365' },
    WDC: { bg: '#d1fae5', fg: '#059669' },
    WDSF: { bg: '#fef3c7', fg: '#d97706' },
    STUDIO: { bg: '#fefcbf', fg: '#744210' },
  };
  const badge = typeBadgeColors[competition.type] || { bg: '#e2e8f0', fg: '#4a5568' };

  const rulesLabel: Record<string, string> = {
    NDCA: 'NDCA Rules',
    USA_DANCE: 'USA Dance Rules',
    WDC: 'WDC Rules',
    WDSF: 'WDSF Rules',
    STUDIO: 'Studio Rules',
  };

  return (
    <>
      <Link to={isCompetitionRoute ? '/' : '/results'} style={{ color: '#667eea', fontSize: '0.9rem' }}>
        &larr; {isCompetitionRoute ? 'Home' : 'All competitions'}
      </Link>
      <div className="card" style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>{competition.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem',
            fontWeight: 600, background: badge.bg, color: badge.fg,
          }}>
            {rulesLabel[competition.type] || competition.type.replace(/_/g, ' ')}
          </span>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#4a5568', marginBottom: '0.75rem' }}>
          {formatDate(competition.date)}
          {competition.location && <> &middot; {competition.location}</>}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        {competition.registrationOpen ? (
          !user ? (
            <Link to={`/login?redirectTo=/competition/${competitionId}`} style={{
              padding: '0.5rem 1rem', background: '#667eea', color: 'white',
              borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            }}>
              Sign in to Register
            </Link>
          ) : myPerson ? (
            <>
              <span style={{
                padding: '0.5rem 0.75rem', background: '#f0fff4', color: '#276749',
                border: '1px solid #c6f6d5', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500,
              }}>
                Registered as {myPerson.firstName} {myPerson.lastName}
              </span>
              <Link to={`/portal?competitionId=${competitionId}`} style={{
                padding: '0.5rem 1rem', background: '#667eea', color: 'white',
                borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
              }}>
                Manage Entries
              </Link>
            </>
          ) : (
            <Link to={`/portal?competitionId=${competitionId}`} style={{
              padding: '0.5rem 1rem', background: '#667eea', color: 'white',
              borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            }}>
              Register
            </Link>
          )
        ) : (
          <span style={{ fontSize: '0.875rem', color: '#a0aec0' }}>Registration closed</span>
        )}
        <Link to={`/pay/${competitionId}`} style={{
          padding: '0.5rem 1rem', background: '#48bb78', color: 'white',
          borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          Pay
        </Link>
        <Link to={`/results/${competitionId}/heats`} style={{
          padding: '0.5rem 1rem', background: '#ed8936', color: 'white',
          borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          Heat Lists
        </Link>
        {isCompetitionRoute && (
          <Link to={`/results/${competitionId}`} style={{
            padding: '0.5rem 1rem', background: '#805ad5', color: 'white',
            borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          }}>
            Results
          </Link>
        )}
        {isAdmin && (
          <Link to={`/competitions/${competitionId}`} style={{
            padding: '0.5rem 1rem', background: '#4a5568', color: 'white',
            borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          }}>
            Manage Competition
          </Link>
        )}
        </div>

        {competition.description && (
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
            {competition.description}
          </p>
        )}
        {(competition.websiteUrl || competition.organizerEmail) && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {competition.websiteUrl && (
              <a href={competition.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea' }}>
                Visit Website
              </a>
            )}
            {competition.organizerEmail && (
              <a href={`mailto:${competition.organizerEmail}`} style={{ color: '#667eea' }}>
                Contact Organizer
              </a>
            )}
          </div>
        )}
      </div>

      {/* Events + search only on /results/:id */}
      {!isCompetitionRoute && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dancer name..."
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '0.5rem 0.75rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
            {isSearching && <span style={{ marginLeft: '0.5rem', color: '#a0aec0', fontSize: '0.8rem' }}>Searching...</span>}
          </div>

          {events.length === 0 ? (
            <p style={{ color: '#a0aec0' }}>
              {search.trim() ? 'No events match that dancer name.' : 'No events for this competition.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {events.map((evt) => {
                const isExpanded = expandedEventId === evt.id;
                const searchResult = 'matchingCouples' in evt ? evt as PublicEventSearchResult : null;
                return (
                  <div key={evt.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                      onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.1s',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#f7fafc')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '')}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{evt.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.15rem' }}>
                          {[evt.style, evt.level].filter(Boolean).join(' \u00b7 ')}
                          {evt.coupleCount > 0 && <> &middot; {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}</>}
                          {evt.rounds.length > 0 && <> &middot; {evt.rounds.length} round{evt.rounds.length !== 1 ? 's' : ''}</>}
                        </div>
                        {searchResult && searchResult.matchingCouples.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#667eea', marginTop: '0.25rem' }}>
                            {searchResult.matchingCouples.map(
                              (mc) => `#${mc.bib} ${mc.leaderName} & ${mc.followerName}`
                            ).join(', ')}
                          </div>
                        )}
                      </div>
                      <span style={{ color: '#a0aec0', fontSize: '1.1rem' }}>
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </span>
                    </div>

                    {isExpanded && evt.rounds.length > 0 && (
                      <div style={{ borderTop: '1px solid #e2e8f0', padding: '0 1rem' }}>
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
      )}
    </>
  );
}

/* ── Main component ── */
const PublicResultsPage = () => {
  const { competitionId } = useParams<{ competitionId?: string }>();

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      {competitionId ? (
        <CompetitionDetail competitionId={Number(competitionId)} />
      ) : (
        <CompetitionList />
      )}
    </div>
  );
};

export default PublicResultsPage;
