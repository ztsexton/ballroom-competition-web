import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { peopleApi, couplesApi, judgesApi, eventsApi, schedulesApi, studiosApi, organizationsApi } from '../api/client';
import { useCompetition } from '../context/CompetitionContext';
import { Studio, Organization } from '../types';

interface WorkflowCounts {
  people: number;
  couples: number;
  judges: number;
  events: number;
  scheduleHeats: number;
  currentHeatIndex: number;
  scheduleExists: boolean;
}

const CompetitionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const { activeCompetition } = useCompetition();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [counts, setCounts] = useState<WorkflowCounts>({
    people: 0, couples: 0, judges: 0, events: 0,
    scheduleHeats: 0, currentHeatIndex: 0, scheduleExists: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) return;
    loadData();
  }, [competitionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [peopleRes, couplesRes, judgesRes, eventsRes] = await Promise.all([
        peopleApi.getAll(competitionId),
        couplesApi.getAll(competitionId),
        judgesApi.getAll(competitionId),
        eventsApi.getAll(competitionId),
      ]);

      let scheduleHeats = 0;
      let currentHeatIndex = 0;
      let scheduleExists = false;
      try {
        const schedRes = await schedulesApi.get(competitionId);
        scheduleHeats = schedRes.data.heatOrder.length;
        currentHeatIndex = schedRes.data.currentHeatIndex;
        scheduleExists = true;
      } catch {
        // no schedule yet
      }

      setCounts({
        people: peopleRes.data.length,
        couples: couplesRes.data.length,
        judges: judgesRes.data.length,
        events: Object.keys(eventsRes.data).length,
        scheduleHeats,
        currentHeatIndex,
        scheduleExists,
      });

      if (activeCompetition?.type === 'STUDIO' && activeCompetition.studioId) {
        try {
          const studioRes = await studiosApi.getById(activeCompetition.studioId);
          setStudio(studioRes.data);
        } catch { /* ignore */ }
      }

      if (activeCompetition?.organizationId) {
        try {
          const orgRes = await organizationsApi.getById(activeCompetition.organizationId);
          setOrganization(orgRes.data);
        } catch { /* ignore */ }
      }
    } catch {
      // counts stay at defaults
    } finally {
      setLoading(false);
    }
  };

  const competition = activeCompetition;

  if (loading) return <div className="loading">Loading...</div>;
  if (!competition) return <div className="card"><p>Competition not found.</p></div>;

  const workflowSteps = [
    {
      label: 'Participants',
      detail: `${counts.people} people, ${counts.couples} couples, ${counts.judges} judges`,
      link: 'participants',
      done: counts.people > 0 && counts.couples > 0,
    },
    {
      label: 'Events',
      detail: counts.events > 0 ? `${counts.events} event${counts.events !== 1 ? 's' : ''} created` : 'No events yet',
      link: 'events',
      done: counts.events > 0,
    },
    {
      label: 'Heat Lists',
      detail: counts.scheduleExists ? `${counts.scheduleHeats} heats generated` : 'Not yet created',
      link: 'heat-lists',
      done: counts.scheduleExists,
    },
    {
      label: 'Run',
      detail: counts.scheduleExists
        ? (counts.currentHeatIndex > 0
          ? `In progress — heat ${counts.currentHeatIndex + 1} of ${counts.scheduleHeats}`
          : 'Ready to start')
        : 'Generate schedule first',
      link: 'run',
      done: false,
    },
  ];

  return (
    <div className="container">
      {/* Competition Info */}
      <div className="card">
        <h2 style={{ marginBottom: '0.75rem' }}>{competition.name}</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: '#4a5568', fontSize: '0.9375rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: competition.type === 'NDCA' ? '#e9d8fd' :
              competition.type === 'USA_DANCE' ? '#bee3f8' :
              competition.type === 'STUDIO' ? '#fefcbf' : '#e2e8f0',
            color: competition.type === 'NDCA' ? '#553c9a' :
              competition.type === 'USA_DANCE' ? '#2a4365' :
              competition.type === 'STUDIO' ? '#744210' : '#4a5568',
          }}>
            {competition.type.replace('_', ' ')}
          </span>
          <span>{new Date(competition.date).toLocaleDateString()}</span>
          {competition.location && <span>{competition.location}</span>}
          {studio && <span>{studio.name}</span>}
          {organization && <span>{organization.name}</span>}
        </div>
        {competition.description && (
          <p style={{ color: '#718096', marginTop: '0.75rem' }}>{competition.description}</p>
        )}
        {competition.levels && competition.levels.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {competition.levels.map((level, idx) => (
              <span key={idx} style={{
                padding: '0.125rem 0.5rem',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                color: '#4a5568',
              }}>
                {level}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Workflow Checklist */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Setup Progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {workflowSteps.map((step, idx) => (
            <Link
              key={step.label}
              to={step.link}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: step.done ? '#f0fff4' : '#f7fafc',
                border: step.done ? '1px solid #c6f6d5' : '1px solid #e2e8f0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Step number / check */}
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step.done ? '#48bb78' : '#e2e8f0',
                color: step.done ? 'white' : '#718096',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}>
                {step.done ? '✓' : idx + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{step.label}</div>
                <div style={{ fontSize: '0.8125rem', color: '#718096' }}>{step.detail}</div>
              </div>
              <span style={{ color: '#a0aec0', fontSize: '1.25rem' }}>&rsaquo;</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Day-Of Links */}
      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Competition Day</h3>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Open these views on separate screens during the competition.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to={`/competitions/${competitionId}/ondeck`} className="btn">
            On-Deck View
          </Link>
          <Link to={`/competitions/${competitionId}/live`} className="btn">
            Live View
          </Link>
          <Link to={`/competitions/${competitionId}/judge`} className="btn">
            Judge Scoring
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CompetitionDetailsPage;
