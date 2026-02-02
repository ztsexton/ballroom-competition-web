import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { eventsApi } from '../api/client';
import { Event } from '../types';
import { useCompetition } from '../context/CompetitionContext';
import { useAuth } from '../context/AuthContext';

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

  if (loading || authLoading) return <div className="loading">Loading...</div>;

  if (!insideHub && !isAdmin) {
    return (
      <div className="container">
        <div className="card">
          <h2>Access Denied</h2>
          <p>You must be an admin to manage events.</p>
        </div>
      </div>
    );
  }

  if (!insideHub && !activeCompetition) {
    return (
      <div className="container">
        <div className="card">
          <h2>Manage Events</h2>
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No Active Competition</p>
            <p style={{ color: '#78350f' }}>Please select a competition to manage events.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Manage Events{!insideHub && activeCompetition ? ` - ${activeCompetition.name}` : ''}</h2>
          <Link to="/events/new" className="btn">Create New Event</Link>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
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
              <table>
                <thead>
                  <tr>
                    <th>Event #</th>
                    <th>Name</th>
                    <th>Details</th>
                    <th>Rounds</th>
                    <th>Competitors</th>
                    <th>Actions</th>
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
                        <td><strong>#{event.id}</strong></td>
                        <td>{event.name}</td>
                        <td style={{ fontSize: '0.875rem', color: '#718096' }}>
                          {[
                            event.designation,
                            event.syllabusType,
                            event.level,
                            event.dances?.join(', ')
                          ].filter(Boolean).join(' \u2022 ') || '\u2014'}
                        </td>
                        <td>{event.heats.length} round{event.heats.length !== 1 ? 's' : ''}</td>
                        <td>{allBibs.size} couple{allBibs.size !== 1 ? 's' : ''}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Link
                              to={`/events/${event.id}`}
                              className="btn"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            >
                              View
                            </Link>
                            <Link
                              to={`/events/${event.id}/entries`}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            >
                              Entries
                            </Link>
                            <Link
                              to={`/events/${event.id}/edit`}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/events/${event.id}/score`}
                              className="btn btn-success"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            >
                              Score
                            </Link>
                            <Link
                              to={`/events/${event.id}/results`}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                            >
                              Results
                            </Link>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="btn btn-danger"
                              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
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
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '1.5rem',
                  padding: '0.75rem',
                  background: '#f7fafc',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}>
                  {allSections.map(({ label, events: sectionEvents }) => (
                    <a
                      key={label}
                      href={`#style-${label.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => {
                        if (collapsedSections[label]) {
                          setCollapsedSections(prev => ({ ...prev, [label]: false }));
                        }
                      }}
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        textDecoration: 'none',
                        background: sectionEvents.length > 0 ? '#667eea' : '#e2e8f0',
                        color: sectionEvents.length > 0 ? '#fff' : '#a0aec0',
                      }}
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
                      style={{ marginBottom: '1.5rem', scrollMarginTop: '1rem' }}
                    >
                      <div
                        onClick={() => toggleSection(label)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '2px solid #e2e8f0',
                          paddingBottom: '0.5rem',
                          marginBottom: isCollapsed ? 0 : '0.75rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <h3 style={{ margin: 0 }}>
                          <span style={{ display: 'inline-block', width: '1.25rem', fontSize: '0.75rem' }}>
                            {isCollapsed ? '\u25b6' : '\u25bc'}
                          </span>
                          {label}
                        </h3>
                        <span style={{ fontSize: '0.875rem', color: '#718096' }}>
                          {sectionEvents.length} event{sectionEvents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {!isCollapsed && (
                        sectionEvents.length > 0 ? (
                          renderEventRows(sectionEvents)
                        ) : (
                          <p style={{ color: '#a0aec0', fontStyle: 'italic', margin: '0.5rem 0' }}>
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
        <div className="card">
          <h3>Quick Stats</h3>
          <p>Total Events: <strong>{events.length}</strong></p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {['Smooth', 'Standard', 'Rhythm', 'Latin', 'Night Club', 'Country'].map(s => {
              const count = events.filter(e => e.style === s).length;
              return count > 0 ? (
                <span key={s} style={{ fontSize: '0.875rem', color: '#718096' }}>
                  {s}: <strong>{count}</strong>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </>
  );

  return <div className="container">{content}</div>;
};

export default EventsPage;
