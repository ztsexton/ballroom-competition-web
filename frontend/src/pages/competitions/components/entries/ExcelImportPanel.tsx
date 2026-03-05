import { useState, useRef, useCallback } from 'react';
import { useToast } from '../../../../context/ToastContext';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import api from '../../../../api/client';

interface DanceEntry {
  dance: string;
  style: string;
}

interface RawImportEntry {
  rowIndex: number;
  level: string;
  ageCategory: string;
  studioName: string;
  studentName: string;
  teacherName: string;
  partnership: 'proam' | 'amateur';
  singleDances: DanceEntry[];
  multiDanceStyles: string[];
  scholarshipStyles: string[];
  showcaseDanceName?: string;
}

interface EventSummaryItem {
  name: string;
  style: string;
  level: string;
  ageCategory: string;
  dances: string[];
  isMultiDance: boolean;
  isScholarship: boolean;
  coupleCount: number;
  couples: { student: string; teacher: string }[];
}

interface ImportPreview {
  entries: RawImportEntry[];
  detectedAgeCategories: { name: string; minAge?: number; maxAge?: number }[];
  detectedLevels: string[];
  detectedStudios: string[];
  detectedDances: Record<string, string[]>;
  detectedPeople: { name: string; role: 'student' | 'professional'; studio: string }[];
  eventSummary: EventSummaryItem[];
  warnings: string[];
}

interface ExcelImportPanelProps {
  competitionId: number;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'committing';

const ExcelImportPanel = ({ competitionId, onImportComplete }: ExcelImportPanelProps) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [commitProgress, setCommitProgress] = useState('');

  // Editable mappings
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [levelMapping, setLevelMapping] = useState<Record<string, string>>({});
  const [studioMapping, setStudioMapping] = useState<Record<string, string>>({});

  // Preview sub-tabs
  const [previewTab, setPreviewTab] = useState<'summary' | 'entries' | 'events' | 'config'>('summary');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      setFile(droppedFile);
      setError('');
    } else {
      setError('Please drop a .xlsx file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<ImportPreview>(
        `/competitions/${competitionId}/import/preview`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setPreview(res.data);
      setExcludedRows(new Set());
      setLevelMapping({});
      setStudioMapping({});
      setStep('preview');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to parse file';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview) return;
    setShowConfirm(false);
    setStep('committing');
    setCommitProgress('Uploading and creating records...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        levelMapping,
        studioMapping,
        excludeRows: Array.from(excludedRows),
      }));
      const res = await api.post<{
        studiosCreated: number;
        peopleCreated: number;
        couplesCreated: number;
        eventsCreated: number;
        warnings: string[];
      }>(
        `/competitions/${competitionId}/import/commit`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const d = res.data;
      showToast(
        `Import complete: ${d.studiosCreated} studios, ${d.peopleCreated} people, ${d.couplesCreated} couples, ${d.eventsCreated} events created.`,
        'success'
      );
      onImportComplete();
      setStep('upload');
      setFile(null);
      setPreview(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Import failed';
      setError(msg);
      showToast(msg, 'error');
      setStep('preview');
    }
  };

  const toggleRow = (rowIndex: number) => {
    setExcludedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (!preview) return;
    if (excludedRows.size === 0) {
      setExcludedRows(new Set(preview.entries.map(e => e.rowIndex)));
    } else {
      setExcludedRows(new Set());
    }
  };

  const includedEntries = preview ? preview.entries.filter(e => !excludedRows.has(e.rowIndex)) : [];
  const includedCount = includedEntries.length;
  const totalCount = preview?.entries.length || 0;

  const uniqueStudents = new Set(includedEntries.map(e => e.studentName)).size;
  const uniqueTeachers = new Set(includedEntries.map(e => e.teacherName)).size;
  const uniqueStudios = new Set(includedEntries.map(e => studioMapping[e.studioName] || e.studioName)).size;

  const resetAll = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setError('');
    setExcludedRows(new Set());
    setLevelMapping({});
    setStudioMapping({});
  };

  // Upload step
  if (step === 'upload') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
        <h4 className="mt-0 mb-3">Import from Excel</h4>
        <p className="text-sm text-gray-600 mb-4">
          Upload a competition entries spreadsheet (.xlsx) to automatically create studios, people, couples, and events.
        </p>

        {error && <div className="text-danger-500 text-sm mb-3">{error}</div>}

        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-100 transition-colors mb-3"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          {file ? (
            <div>
              <p className="font-medium text-blue-700">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-500 mb-1">Drag and drop your .xlsx file here</p>
              <p className="text-xs text-gray-400">or click to browse</p>
            </div>
          )}
        </div>

        <button
          className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!file || loading}
          onClick={handleUpload}
        >
          {loading ? 'Parsing...' : 'Upload & Preview'}
        </button>
      </div>
    );
  }

  // Committing step
  if (step === 'committing') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
        <h4 className="mt-0 mb-3">Importing...</h4>
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
          <span className="text-sm text-gray-600">{commitProgress}</span>
        </div>
      </div>
    );
  }

  // Preview step
  if (!preview) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="mt-0 mb-0">Import Preview</h4>
        <button
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs font-medium hover:bg-gray-300"
          onClick={resetAll}
        >
          Start Over
        </button>
      </div>

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-sm font-medium text-yellow-800 mb-1">Warnings ({preview.warnings.length})</p>
          <ul className="text-xs text-yellow-700 list-disc pl-4 m-0 max-h-[120px] overflow-y-auto">
            {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Entries" value={`${includedCount} / ${totalCount}`} />
        <SummaryCard label="Students" value={uniqueStudents} />
        <SummaryCard label="Teachers" value={uniqueTeachers} />
        <SummaryCard label="Studios" value={uniqueStudios} />
      </div>

      {/* Preview tabs */}
      <div className="flex border-b border-gray-200 mb-4 gap-1">
        {(['summary', 'config', 'entries', 'events'] as const).map(tab => (
          <button
            key={tab}
            className={`px-4 py-2 bg-transparent border-none cursor-pointer text-sm transition-all ${
              previewTab === tab
                ? 'text-primary-500 border-b-2 border-primary-500 font-semibold'
                : 'text-gray-500 border-b-2 border-transparent'
            }`}
            onClick={() => setPreviewTab(tab)}
          >
            {tab === 'summary' ? 'Summary' : tab === 'config' ? 'Configuration' : tab === 'entries' ? 'Entries' : 'Events'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {previewTab === 'summary' && (
        <SummaryTab preview={preview} includedCount={includedCount} />
      )}

      {previewTab === 'config' && (
        <ConfigTab
          preview={preview}
          levelMapping={levelMapping}
          setLevelMapping={setLevelMapping}
          studioMapping={studioMapping}
          setStudioMapping={setStudioMapping}
        />
      )}

      {previewTab === 'entries' && (
        <EntriesTab
          entries={preview.entries}
          excludedRows={excludedRows}
          toggleRow={toggleRow}
          toggleAllRows={toggleAllRows}
        />
      )}

      {previewTab === 'events' && (
        <EventsTab eventSummary={preview.eventSummary} excludedRows={excludedRows} />
      )}

      {/* Import button */}
      <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-3">
        <button
          className="px-5 py-2.5 bg-green-600 text-white rounded border-none cursor-pointer text-sm font-semibold transition-colors hover:bg-green-700"
          onClick={() => setShowConfirm(true)}
        >
          Import {includedCount} Entries
        </button>
        <span className="text-xs text-gray-500">
          This will create studios, people, couples, and events in the competition.
        </span>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Import"
        message={`This will create approximately ${uniqueStudios} studios, ${uniqueStudents + uniqueTeachers} people, ${includedCount} couples, and ${preview.eventSummary.length} events. This action cannot be easily undone. Continue?`}
        confirmLabel="Import"
        variant="warning"
        onConfirm={handleCommit}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

// --- Sub-components ---

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
      <p className="text-2xl font-bold text-primary-600 m-0">{value}</p>
      <p className="text-xs text-gray-500 m-0 mt-1">{label}</p>
    </div>
  );
}

function SummaryTab({ preview, includedCount }: { preview: ImportPreview; includedCount: number }) {
  return (
    <div className="space-y-4">
      {/* Age categories */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Age Categories ({preview.detectedAgeCategories.length})</h5>
        <div className="flex flex-wrap gap-2">
          {preview.detectedAgeCategories.map(ac => (
            <span key={ac.name} className="px-2 py-1 bg-white rounded border border-gray-200 text-xs">
              {ac.name}
              {ac.minAge != null && ac.maxAge != null && ` (${ac.minAge}-${ac.maxAge})`}
              {ac.minAge != null && ac.maxAge == null && ` (${ac.minAge}+)`}
              {ac.minAge == null && ac.maxAge != null && ` (under ${ac.maxAge + 1})`}
            </span>
          ))}
        </div>
      </div>

      {/* Levels */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Levels ({preview.detectedLevels.length})</h5>
        <div className="flex flex-wrap gap-2">
          {preview.detectedLevels.map(level => (
            <span key={level} className="px-2 py-1 bg-white rounded border border-gray-200 text-xs">
              {level}
            </span>
          ))}
        </div>
      </div>

      {/* Dances by style */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Dances by Style</h5>
        <div className="space-y-2">
          {Object.entries(preview.detectedDances).map(([style, dances]) => (
            <div key={style} className="flex items-start gap-2">
              <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{style}:</span>
              <div className="flex flex-wrap gap-1">
                {dances.map(d => (
                  <span key={d} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Studios */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Studios ({preview.detectedStudios.length})</h5>
        <div className="flex flex-wrap gap-2">
          {preview.detectedStudios.map(s => (
            <span key={s} className="px-2 py-1 bg-white rounded border border-gray-200 text-xs">{s}</span>
          ))}
        </div>
      </div>

      {/* People summary */}
      <div>
        <h5 className="text-sm font-semibold mb-2">People ({preview.detectedPeople.length})</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[200px] overflow-y-auto">
          {preview.detectedPeople.map((p, i) => (
            <div key={i} className="text-xs flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${p.role === 'professional' ? 'bg-blue-500' : 'bg-green-500'}`}>
                {p.role === 'professional' ? 'PRO' : 'STU'}
              </span>
              <span>{p.name}</span>
              {p.studio && <span className="text-gray-400">({p.studio})</span>}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {includedCount} entries will be imported. Switch to the Configuration tab to adjust mappings, or Entries tab to include/exclude specific rows.
      </p>
    </div>
  );
}

function ConfigTab({
  preview,
  levelMapping,
  setLevelMapping,
  studioMapping,
  setStudioMapping,
}: {
  preview: ImportPreview;
  levelMapping: Record<string, string>;
  setLevelMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  studioMapping: Record<string, string>;
  setStudioMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="space-y-5">
      {/* Level mapping */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Level Mapping</h5>
        <p className="text-xs text-gray-500 mb-2">Adjust how detected levels map to your competition's levels. Leave blank to use as-is.</p>
        <div className="space-y-1">
          {preview.detectedLevels.map(level => (
            <div key={level} className="flex items-center gap-2">
              <span className="text-sm w-36 shrink-0">{level}</span>
              <span className="text-gray-400 text-sm">&rarr;</span>
              <input
                type="text"
                className="px-2 py-1 border border-gray-300 rounded text-sm w-40 focus:outline-none focus:border-primary-500"
                placeholder={level}
                value={levelMapping[level] || ''}
                onChange={e => setLevelMapping(prev => ({ ...prev, [level]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Studio mapping */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Studio Mapping</h5>
        <p className="text-xs text-gray-500 mb-2">Rename or merge studios. Leave blank to use as-is.</p>
        <div className="space-y-1">
          {preview.detectedStudios.map(studio => (
            <div key={studio} className="flex items-center gap-2">
              <span className="text-sm w-48 shrink-0 truncate" title={studio}>{studio}</span>
              <span className="text-gray-400 text-sm">&rarr;</span>
              <input
                type="text"
                className="px-2 py-1 border border-gray-300 rounded text-sm w-48 focus:outline-none focus:border-primary-500"
                placeholder={studio}
                value={studioMapping[studio] || ''}
                onChange={e => setStudioMapping(prev => ({ ...prev, [studio]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Age categories (read-only display) */}
      <div>
        <h5 className="text-sm font-semibold mb-2">Detected Age Categories</h5>
        <p className="text-xs text-gray-500 mb-2">These age categories were parsed from the spreadsheet header.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold border-b border-gray-200">Name</th>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold border-b border-gray-200">Min Age</th>
                <th className="text-left px-3 py-2 bg-gray-50 font-semibold border-b border-gray-200">Max Age</th>
              </tr>
            </thead>
            <tbody>
              {preview.detectedAgeCategories.map(ac => (
                <tr key={ac.name}>
                  <td className="px-3 py-2 border-b border-gray-100">{ac.name}</td>
                  <td className="px-3 py-2 border-b border-gray-100">{ac.minAge ?? '-'}</td>
                  <td className="px-3 py-2 border-b border-gray-100">{ac.maxAge ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EntriesTab({
  entries,
  excludedRows,
  toggleRow,
  toggleAllRows,
}: {
  entries: RawImportEntry[];
  excludedRows: Set<number>;
  toggleRow: (rowIndex: number) => void;
  toggleAllRows: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-2 py-1 bg-gray-200 text-gray-700 rounded border-none cursor-pointer text-xs hover:bg-gray-300"
          onClick={toggleAllRows}
        >
          {excludedRows.size === 0 ? 'Exclude All' : excludedRows.size === entries.length ? 'Include All' : 'Include All'}
        </button>
        <span className="text-xs text-gray-500">
          {entries.length - excludedRows.size} of {entries.length} entries included
        </span>
      </div>
      <div className="max-h-[400px] overflow-auto border border-gray-200 rounded-md">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold w-8">Inc</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Level</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Age</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Studio</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Student</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Teacher</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Type</th>
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold">Dances</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const excluded = excludedRows.has(entry.rowIndex);
              const danceList = [
                ...entry.singleDances.map(d => d.dance),
                ...entry.multiDanceStyles.map(s => `${s} (multi)`),
                ...entry.scholarshipStyles.map(s => `${s} (scholar)`),
                ...(entry.showcaseDanceName ? [`Showcase: ${entry.showcaseDanceName}`] : []),
              ];
              return (
                <tr
                  key={entry.rowIndex}
                  className={excluded ? 'opacity-40 bg-gray-50' : 'hover:bg-blue-50'}
                >
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => toggleRow(entry.rowIndex)}
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{entry.level}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{entry.ageCategory}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{entry.studioName}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 font-medium">{entry.studentName}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">{entry.teacherName}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] text-white ${entry.partnership === 'proam' ? 'bg-blue-500' : 'bg-green-500'}`}>
                      {entry.partnership === 'proam' ? 'Pro/Am' : 'Amateur'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 max-w-[200px]">
                    <span className="truncate block" title={danceList.join(', ')}>
                      {danceList.join(', ') || '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsTab({
  eventSummary,
  excludedRows,
}: {
  eventSummary: EventSummaryItem[];
  excludedRows: Set<number>;
}) {
  const excludedCount = excludedRows.size;

  // Group events by style
  const byStyle: Record<string, EventSummaryItem[]> = {};
  for (const evt of eventSummary) {
    const key = evt.style || 'Other';
    if (!byStyle[key]) byStyle[key] = [];
    byStyle[key].push(evt);
  }

  return (
    <div>
      {excludedCount > 0 && (
        <p className="text-xs text-yellow-600 mb-2">
          Note: {excludedCount} entries are excluded. The actual events created may differ.
        </p>
      )}
      <p className="text-xs text-gray-500 mb-3">{eventSummary.length} events will be created</p>

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {Object.entries(byStyle).map(([style, events]) => (
          <div key={style}>
            <h5 className="text-sm font-semibold text-gray-700 mb-1 sticky top-0 bg-blue-50 py-1">{style} ({events.length})</h5>
            <div className="space-y-1">
              {events.map((evt, i) => (
                <div key={i} className="bg-white rounded border border-gray-200 px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-medium">{evt.name}</span>
                    {evt.dances.length > 0 && (
                      <span className="text-gray-400 ml-2">({evt.dances.join(', ')})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {evt.isScholarship && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">Scholarship</span>
                    )}
                    {evt.isMultiDance && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">Multi-dance</span>
                    )}
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                      {evt.coupleCount} couple{evt.coupleCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExcelImportPanel;
