import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { PersonHeatListResponse, Competition, Person } from '../../types';
import { participantApi, competitionsApi, schedulesApi } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';
import { PersonHeatSheet } from '../../components/PersonHeatSheet';
import { useAuth } from '../../context/AuthContext';

const PersonHeatListPage = () => {
  const { id: competitionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const personIdParam = searchParams.get('personId');
  const { isAnyAdmin } = useAuth();

  const [data, setData] = useState<PersonHeatListResponse | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(
    personIdParam ? Number(personIdParam) : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [allPdfLoading, setAllPdfLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Load competition and people list (for admin picker)
  useEffect(() => {
    if (!competitionId) return;
    competitionsApi.getById(Number(competitionId))
      .then(r => setCompetition(r.data))
      .catch(() => {});
  }, [competitionId]);

  // If no personId specified, find the logged-in user's person
  useEffect(() => {
    if (!competitionId) return;
    if (selectedPersonId) return;

    participantApi.getProfile()
      .then(r => {
        const myPerson = r.data.find(p => p.competitionId === Number(competitionId));
        if (myPerson) {
          setSelectedPersonId(myPerson.id);
        } else {
          setError('You are not registered in this competition.');
          setLoading(false);
        }
      })
      .catch(() => {
        setError('Failed to load profile.');
        setLoading(false);
      });
  }, [competitionId, selectedPersonId]);

  // Load people list for admin person picker
  useEffect(() => {
    if (!competitionId || !isAnyAdmin) return;
    import('../../api/client').then(({ peopleApi }) => {
      peopleApi.getAll(Number(competitionId))
        .then(r => setPeople(r.data))
        .catch(() => {});
    });
  }, [competitionId, isAnyAdmin]);

  const handleDownloadPDF = async () => {
    if (!competitionId || !selectedPersonId) return;
    setPdfLoading(true);
    try {
      const res = await schedulesApi.downloadHeatSheetPDF(Number(competitionId), selectedPersonId);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatsheet-${data?.firstName}-${data?.lastName}.pdf`.toLowerCase();
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setPdfLoading(false); }
  };

  const handleEmailPDF = async () => {
    if (!competitionId || !selectedPersonId) return;
    setEmailLoading(true);
    setEmailStatus(null);
    try {
      const res = await schedulesApi.emailHeatSheet(Number(competitionId), selectedPersonId);
      setEmailStatus(`Sent to ${res.data.sentTo}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send email';
      setEmailStatus(msg);
    } finally { setEmailLoading(false); }
  };

  const handleDownloadAll = async () => {
    if (!competitionId) return;
    setAllPdfLoading(true);
    try {
      const res = await schedulesApi.downloadAllHeatSheetsPDF(Number(competitionId));
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'heatsheets-all.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setAllPdfLoading(false); }
  };

  // Fetch heat list for selected person
  useEffect(() => {
    if (!competitionId || !selectedPersonId) return;
    setLoading(true);
    setError(null);
    participantApi.getPersonHeatlists(Number(competitionId), selectedPersonId)
      .then(r => setData(r.data))
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load heat list');
      })
      .finally(() => setLoading(false));
  }, [competitionId, selectedPersonId]);

  return (
    <div className="max-w-4xl mx-auto px-8 pt-6 pb-12">
      {/* Navigation — hidden when printing */}
      <div className="print:hidden">
        <Link
          to={`/competitions/${competitionId}`}
          className="text-primary-500 text-sm hover:underline"
        >
          &larr; Back to Competition
        </Link>

        {/* Admin person picker */}
        {isAnyAdmin && people.length > 0 && (
          <div className="mt-3 mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              View heat sheet for:
            </label>
            <select
              value={selectedPersonId || ''}
              onChange={e => setSelectedPersonId(Number(e.target.value))}
              className="w-full max-w-md border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a person...</option>
              {people
                .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName} ({p.role})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Action buttons */}
        {data && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
            >
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="px-3 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded border-none disabled:opacity-50"
            >
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </button>
            {isAnyAdmin && (
              <button
                onClick={handleEmailPDF}
                disabled={emailLoading}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 disabled:opacity-50"
              >
                {emailLoading ? 'Sending...' : 'Email PDF'}
              </button>
            )}
            {isAnyAdmin && (
              <button
                onClick={handleDownloadAll}
                disabled={allPdfLoading}
                className="ml-auto px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-800 text-white rounded border-none disabled:opacity-50"
              >
                {allPdfLoading ? 'Generating...' : 'Download All Heat Sheets'}
              </button>
            )}
            {emailStatus && (
              <span className="text-xs text-gray-500 ml-2">{emailStatus}</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-4">
          <Skeleton className="h-8 w-64 mx-auto mb-6" />
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton variant="table" rows={4} cols={3} />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-center text-danger-500 mt-8">{error}</div>
      ) : data ? (
        <PersonHeatSheet data={data} competitionName={competition?.name} />
      ) : null}
    </div>
  );
};

export default PersonHeatListPage;
