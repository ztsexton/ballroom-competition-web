import { useCompetition } from '../../context/CompetitionContext';
import { useNavigate } from 'react-router-dom';
import ExcelImportPanel from './components/entries/ExcelImportPanel';

const CompetitionImportPage = () => {
  const { activeCompetition } = useCompetition();
  const competitionId = activeCompetition?.id || 0;
  const navigate = useNavigate();

  if (!competitionId) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          No active competition selected.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mt-0 mb-2">
          Import Competition Data
        </h2>
        <p className="text-sm text-gray-500 m-0">
          Upload an Excel spreadsheet (.xlsx) to bulk-create studios, people, couples, and events for this competition.
          Review the parsed data as a draft before committing.
        </p>
      </div>

      <ExcelImportPanel
        competitionId={competitionId}
        onImportComplete={() => navigate(`/competitions/${competitionId}/participants`)}
      />
    </div>
  );
};

export default CompetitionImportPage;
