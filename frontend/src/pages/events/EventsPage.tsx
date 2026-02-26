import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { eventsApi } from '../../api/client';
import { Event } from '../../types';
import { useCompetition } from '../../context/CompetitionContext';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/Skeleton';

const STYLE_SECTIONS = ['Smooth', 'Standard', 'Rhythm', 'Latin', 'Night Club', 'Country'];

const EventsPage = () => {
  const { id: hubId } = useParams<{ id: string }>();
  const insideHub = !!hubId;
  const { activeCompetition, competitions, setActiveCompetition } = useCompetition();
  const { isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const location = useLocation();

  useEffect(() => {
    if (!insideHub) {
      const params = new URLSearchParams(location.search);
      const competitionId = params.get('competitionId');
      if (competitionId && competitions.length > 0) {
        const comp = competitions.find(c => c.id === Number(competitionId));
        if (comp && (!activeCompetition || activeCompetition.id !== comp.id)) {
          setActiveCompetition(comp);
        }
      }
    }
    if (activeCompetition) {
      loadEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompetition, competitions, location.search]);

  const loadEvents = async () => {
    if (!activeCompetition) return;

    try {
      const response = await eventsApi.getAll(activeCompetition.id);
      setEvents(Object.values(response.data));
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this event? This will also delete all associated scores.')) {
      return;
    }

    try {
      await eventsApi.delete(id);
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete event');
    }
  };

  if (loading || authLoading) return <div className="max-w-7xl mx-auto p-8"><Skeleton variant="card" /></div>;

  if (!insideHub && !isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage events.</p>
        </div>
      </div>
    );
  }

  if (!insideHub && !activeCompetition) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2>Manage Events</h2>
          <div className="text-center p-12 bg-amber-50 border border-amber-400 rounded-lg">
            <p className="text-lg mb-2">No Active Competition</p>
            <p className="text-amber-900">Please select a competition to manage events.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2>Manage Events{!insideHub && activeCompetition ? ` - ${activeCompetition.name}` : ''}</h2>
          <Link to="/events/new" className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 no-underline">Create New Event</Link>
        </div>

        {events.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <h3>No events created yet</h3>
            <p>Create your first event to get started!</p>
          </div>
        ) : (
          (() => {
            const eventsByStyle: Record<string, Event[]> = {};
            for (const s of STYLE_SECTIONS) eventsByStyle[s] = [];
            const otherEvents: Event[] = [];
            for (const event of events) {
              const section = STYLE_SECTIONS.find(s => s === event.style);
              if (section) {
                eventsByStyle[section].push(event);
              } else {
                otherEvents.push(event);
              }
            }

            const allSections = [
              ...STYLE_SECTIONS.map(s => ({ label: s, events: eventsByStyle[s] })),
              ...(otherEvents.length > 0 ? [{ label: 'Other', events: otherEvents }] : []),
            ];

            const toggleSection = (label: string) => {
              setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
            };

            const renderEventRows = (sectionEvents: Event[]) => (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Event #</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Name</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Details</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Rounds</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Competitors</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium border-b border-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionEvents.map(event => {
                    const allBibs = new Set<number>();
                    event.heats.forEach(heat => {
                      heat.bibs.forEach(bib => allBibs.add(bib));
                    });

                    return (
                      <tr key={event.id}>
                        <td className="px-3 py-2 border-t border-gray-100"><strong>#{event.id}</strong></td>
                        <td className="px-3 py-2 border-t border-gray-100">{event.name}</td>
                        <td className="px-3 py-2 border-t border-gray-100 text-sm text-gray-500">
                          {[
                            event.designation,
                            event.syllabusType,
                            event.level,
                            event.dances?.join(', ')
                          ].filter(Boolean).join(' \u2022 ') || '\u2014'}
                        </td>
                        <td className="px-3 py-2 border-t border-gray-100">{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}</td>
                        <td className="px-3 py-2 border-t border-gray-100">{allBibs.size} couple{allBibs.size !== 1 ? 's' : ''}</td>
                        <td className="px-3 py-2 border-t border-gray-100">
                          <div className="flex gap-2">
                            <Link
                              to={`/events/${event.id}`}
                              className="px-2 py-1 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 no-underline"
                            >
                              View
                            </Link>
                            <Link
                              to={`/events/${event.id}/entries`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Entries
                            </Link>
                            <Link
                              to={`/events/${event.id}/edit`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/events/${event.id}/score`}
                              className="px-2 py-1 bg-success-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-success-600 no-underline"
                            >
                              Score
                            </Link>
                            <Link
                              to={`/events/${event.id}/results`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer text-sm font-medium transition-colors hover:bg-gray-200 no-underline"
                            >
                              Results
                            </Link>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="px-2 py-1 bg-danger-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-danger-600"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );

            return (
              <>
                {/* Jump nav */}
                <div className="flex gap-2 flex-wrap mb-6 p-3 bg-gray-50 rounded-md border border-gray-200">
                  {allSections.map(({ label, events: sectionEvents }) => (
                    <a
                      key={label}
                      href={`#style-${label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        if (collapsedSections[label]) {
                          setCollapsedSections(prev => ({ ...prev, [label]: false }));
                        }
                      }}
                      className={`px-3 py-1 rounded text-sm no-underline ${
                        sectionEvents.length > 0 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {label} ({sectionEvents.length})
                    </a>
                  ))}
                </div>

                {/* Sections */}
                {allSections.map(({ label, events: sectionEvents }) => {
                  const isCollapsed = !!collapsedSections[label];
                  return (
                    <div
                      key={label}
                      id={`style-${label.toLowerCase().replace(/\s+/g, '-')}`}
                      className="mb-6 scroll-mt-4"
                    >
                      <div
                        onClick={() => toggleSection(label)}
                        className={`flex justify-between items-center border-b-2 border-gray-200 pb-2 cursor-pointer select-none ${isCollapsed ? '' : 'mb-3'}`}
                      >
                        <h3 className="m-0">
                          <span className="inline-block w-5 text-xs">
                            {isCollapsed ? '\u25b6' : '\u25bc'}
                          </span>
                          {label}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {sectionEvents.length} event{sectionEvents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {!isCollapsed && (
                        sectionEvents.length > 0 ? (
                          renderEventRows(sectionEvents)
                        ) : (
                          <p className="text-gray-400 italic my-2">
                            No {label.toLowerCase()} events
                          </p>
                        )
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()
        )}
      </div>

      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3>Quick Stats</h3>
          <p>Total Events: <strong>{events.length}</strong></p>
          <div className="flex gap-4 flex-wrap mt-2">
            {['Smooth', 'Standard', 'Rhythm', 'Latin', 'Night Club', 'Country'].map(s => {
              const count = events.filter(e => e.style === s).length;
              return count > 0 ? (
                <span key={s} className="text-sm text-gray-500">
                  {s}: <strong>{count}</strong>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </>
  );

  return <div className="max-w-7xl mx-auto p-8">{content}</div>;
};

export default EventsPage;
