import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { competitionsApi, studiosApi, organizationsApi } from '../../api/client';
import { useCompetition } from '../../context/CompetitionContext';
import { Studio, Organization } from '../../types';
import { CompetitionTypeBadge } from '../../components/CompetitionTypeBadge';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../context/ToastContext';

interface WorkflowCounts {
  people: number;
  couples: number;
  judges: number;
  events: number;
  scheduleHeats: number;
  currentHeatIndex: number;
  completedCount: number;
  scheduleExists: boolean;
}

interface ValidationIssue {
  eventId: number;
  eventName: string;
  eventLevel: string;
  bib: number;
  leaderName: string;
  followerName: string;
  coupleLevel: string | null;
  allowedLevels: string[];
  reason: string;
}

interface PendingEntryEnriched {
  id: string;
  bib: number;
  combination: {
    designation?: string;
    syllabusType?: string;
    level?: string;
    style?: string;
    dances?: string[];
    scoringType?: string;
    ageCategory?: string;
  };
  reason: string;
  requestedAt: string;
  leaderName: string;
  followerName: string;
}

const CompetitionDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const competitionId = parseInt(id || '0');
  const { activeCompetition, refreshCompetitions } = useCompetition();
  const { showToast } = useToast();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [counts, setCounts] = useState<WorkflowCounts>({
    people: 0, couples: 0, judges: 0, events: 0,
    scheduleHeats: 0, currentHeatIndex: 0, completedCount: 0, scheduleExists: false,
  });
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [validationExpanded, setValidationExpanded] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<PendingEntryEnriched[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) return;
    loadData();
  }, [competitionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const summaryRes = await competitionsApi.getSummary(competitionId);
      const { counts: c, schedule: s } = summaryRes.data;

      setCounts({
        people: c.people,
        couples: c.couples,
        judges: c.judges,
        events: c.events,
        scheduleHeats: s.scheduleHeats,
        currentHeatIndex: s.currentHeatIndex,
        completedCount: s.completedCount,
        scheduleExists: s.scheduleExists,
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

      // Load validation issues if entry validation is enabled
      if (activeCompetition?.entryValidation?.enabled) {
        try {
          const valRes = await competitionsApi.getValidationIssues(competitionId);
          setValidationIssues(valRes.data.issues);
        } catch { /* ignore */ }
      }

      // Load pending entries
      try {
        const pendingRes = await competitionsApi.getPendingEntries(competitionId);
        setPendingEntries(pendingRes.data.pendingEntries);
      } catch { /* ignore */ }
    } catch {
      // counts stay at defaults
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    try {
      await competitionsApi.approvePendingEntry(competitionId, entryId);
      showToast('Entry approved', 'success');
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to approve entry', 'error');
    }
  };

  const handleReject = async (entryId: string) => {
    try {
      await competitionsApi.rejectPendingEntry(competitionId, entryId);
      showToast('Entry rejected', 'info');
      await refreshCompetitions();
      await loadData();
    } catch {
      showToast('Failed to reject entry', 'error');
    }
  };

  const competition = activeCompetition;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Skeleton variant="card" className="mb-4" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (!competition) return <div className="bg-white rounded-lg shadow p-6"><p>Competition not found.</p></div>;

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
        ? (counts.completedCount > 0 && counts.completedCount === counts.scheduleHeats
          ? `Complete — all ${counts.scheduleHeats} heats done`
          : counts.currentHeatIndex > 0
            ? `In progress — heat ${Math.min(counts.currentHeatIndex + 1, counts.scheduleHeats)} of ${counts.scheduleHeats}`
            : 'Ready to start')
        : 'Generate schedule first',
      link: 'run',
      done: counts.completedCount > 0 && counts.completedCount === counts.scheduleHeats,
    },
    {
      label: 'Results',
      detail: counts.events > 0 ? 'View event results and scores' : 'No events yet',
      link: 'results',
      done: counts.completedCount > 0 && counts.completedCount === counts.scheduleHeats,
    },
  ];

  const formatCombination = (c: PendingEntryEnriched['combination']) =>
    [c.designation, c.syllabusType, c.level, c.style, c.dances?.join(', ')].filter(Boolean).join(' \u2022 ') || '\u2014';

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Competition Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-3">{competition.name}</h2>
        <div className="flex gap-4 flex-wrap text-gray-600 text-[0.9375rem] items-center">
          <CompetitionTypeBadge type={competition.type} />
          <span>{new Date(competition.date).toLocaleDateString()}</span>
          {competition.location && <span>{competition.location}</span>}
          {studio && <span>{studio.name}</span>}
          {organization && <span>{organization.name}</span>}
        </div>
        {competition.description && (
          <p className="text-gray-500 mt-3">{competition.description}</p>
        )}
      </div>

      {/* Pending Entries Approval Queue */}
      {pendingEntries.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg shadow p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-600 text-xl">&#9888;</span>
            <h3 className="text-base font-semibold text-amber-800">
              {pendingEntries.length} Pending Entry Approval{pendingEntries.length !== 1 ? 's' : ''}
            </h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            These entries are outside the couple's current level range and need your approval.
          </p>
          <div className="space-y-2">
            {pendingEntries.map(entry => (
              <div key={entry.id} className="bg-white border border-amber-200 rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-800">Bib {entry.bib}</span>
                      <span className="text-gray-500 mx-1.5">&middot;</span>
                      <span className="text-gray-700">{entry.leaderName} &amp; {entry.followerName}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {formatCombination(entry.combination)}
                    </div>
                    <p className="text-xs text-amber-600 mt-1">{entry.reason}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested {new Date(entry.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(entry.id)}
                      className="px-3 py-1.5 bg-success-500 text-white rounded border-none cursor-pointer text-xs font-medium hover:bg-success-600 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(entry.id)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs font-medium hover:bg-gray-300 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg shadow p-5 mb-6">
          <button
            onClick={() => setValidationExpanded(!validationExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-600 text-xl">&#9888;</span>
              <h3 className="text-base font-semibold text-amber-800">
                {validationIssues.length} Entry Validation Issue{validationIssues.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <span className="text-amber-600 text-sm">{validationExpanded ? 'Hide' : 'Show details'}</span>
          </button>
          {validationExpanded && (
            <div className="mt-3 space-y-2">
              {validationIssues.map((issue, i) => (
                <div key={i} className="bg-white border border-amber-200 rounded p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-gray-800">Bib {issue.bib}</span>
                      <span className="text-gray-500 mx-1.5">&middot;</span>
                      <span className="text-gray-700">{issue.leaderName} &amp; {issue.followerName}</span>
                    </div>
                    <Link
                      to={`events`}
                      className="text-xs text-primary-600 no-underline hover:underline whitespace-nowrap"
                    >
                      View Events
                    </Link>
                  </div>
                  <p className="text-amber-700 mt-1 text-[0.8125rem]">
                    <span className="font-medium">{issue.eventName}</span>: {issue.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Workflow Checklist */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Setup Progress</h3>
        <div className="flex flex-col gap-3">
          {workflowSteps.map((step, idx) => (
            <Link
              key={step.label}
              to={step.link}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-lg no-underline text-inherit transition-colors ${
                step.done ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
              } hover:border-primary-300`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                step.done ? 'bg-success-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step.done ? '\u2713' : idx + 1}
              </span>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{step.label}</div>
                <div className="text-[0.8125rem] text-gray-500">{step.detail}</div>
              </div>
              <span className="text-gray-400 text-xl">&rsaquo;</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Day-Of Links */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Competition Day</h3>
        <p className="text-sm text-gray-500 mb-4">
          Open these views on separate screens during the competition.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link to={`/competitions/${competitionId}/ondeck`} className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors">
            On-Deck View
          </Link>
          <Link to={`/competitions/${competitionId}/live`} className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors">
            Live View
          </Link>
          <Link to={`/competitions/${competitionId}/judge`} className="inline-block px-4 py-2 bg-primary-500 text-white rounded no-underline text-sm font-medium hover:bg-primary-600 transition-colors">
            Judge Scoring
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CompetitionDetailsPage;
