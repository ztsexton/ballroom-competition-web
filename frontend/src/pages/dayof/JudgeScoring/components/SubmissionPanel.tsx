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
      <div className="px-4 py-3 bg-red-100 rounded-md mt-4">
        {validationErrors.map((err, i) => (
          <p key={i} className={`text-red-800 text-sm ${i > 0 ? 'mt-1' : 'm-0'}`}>
            {err}
          </p>
        ))}
      </div>
    )}

    {showConfirm && (
      <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg mt-3 text-center">
        <p className="font-semibold mb-2 text-blue-900 text-[0.9375rem]">
          Submit {isMultiDance && activeDance ? `${activeDance} scores` : 'scores'}{isMultiEntry ? ` across ${entryCount} events` : ''}?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancelConfirm}
            disabled={submitting}
            className="flex-1 p-2.5 min-h-[44px] bg-white text-gray-600 border border-gray-300 rounded-md text-[0.9375rem] cursor-pointer touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmSubmit}
            disabled={submitting}
            className={`flex-1 p-2.5 min-h-[44px] bg-success-500 text-white border-none rounded-md text-[0.9375rem] font-bold touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
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
        className={`w-full mt-3 p-3 min-h-[48px] bg-success-500 text-white border-none rounded-lg text-lg font-bold transition-opacity duration-150 touch-manipulation select-none [-webkit-tap-highlight-color:transparent] ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
      >
        {submitting ? 'Submitting...' : isMultiDance && activeDance ? `Submit ${activeDance}` : isMultiEntry ? 'Submit All Scores' : 'Submit Scores'}
      </button>
    )}
  </>
);

export default SubmissionPanel;
