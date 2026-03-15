interface SubmissionPanelProps {
  validationErrors: string[];
  showConfirm: boolean;
  submitting: boolean;
  isMultiDance: boolean;
  isMultiEntry: boolean;
  activeDance: string | null;
  entryCount: number;
  onSubmitClick: () => void;
  onConfirmSubmit: () => void;
  onCancelConfirm: () => void;
}

const SubmissionPanel = ({
  validationErrors,
  showConfirm,
  submitting,
  isMultiDance,
  isMultiEntry,
  activeDance,
  entryCount,
  onSubmitClick,
  onConfirmSubmit,
  onCancelConfirm,
}: SubmissionPanelProps) => (
  <>
    {validationErrors.length > 0 && (
      <div className="px-3 py-2 bg-red-100 rounded-md mt-2">
        {validationErrors.map((err, i) => (
          <p key={i} className={`text-red-800 text-xs ${i > 0 ? 'mt-0.5' : 'm-0'}`}>
            {err}
          </p>
        ))}
      </div>
    )}

    {showConfirm && (
      <div className="p-2.5 bg-blue-50 border-2 border-blue-200 rounded-lg mt-2 text-center">
        <p className="font-semibold mb-1.5 text-blue-900 text-sm">
          Submit {isMultiDance && activeDance ? `${activeDance} scores` : 'scores'}{isMultiEntry ? ` across ${entryCount} events` : ''}?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancelConfirm}
            disabled={submitting}
            className="flex-1 p-2 min-h-[40px] bg-white text-gray-600 border border-gray-300 rounded-md text-sm cursor-pointer touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmSubmit}
            disabled={submitting}
            className={`flex-1 p-2 min-h-[40px] bg-success-500 text-white border-none rounded-md text-sm font-bold touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
          >
            {submitting ? 'Submitting...' : 'Confirm'}
          </button>
        </div>
      </div>
    )}

    {!showConfirm && (
      <button
        onClick={onSubmitClick}
        disabled={submitting}
        className={`w-full mt-2 p-2.5 min-h-[44px] bg-success-500 text-white border-none rounded-lg text-base font-bold transition-opacity duration-150 touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
      >
        {submitting ? 'Submitting...' : isMultiDance && activeDance ? `Submit ${activeDance}` : isMultiEntry ? 'Submit All Scores' : 'Submit Scores'}
      </button>
    )}
  </>
);

export default SubmissionPanel;
