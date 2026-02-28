interface DanceProgressIndicatorProps {
  activeDance: string;
  allDances: string[];
  submittedDances: Set<string>;
  currentDanceIndex: number;
}

const DanceProgressIndicator = ({ activeDance, allDances, submittedDances, currentDanceIndex }: DanceProgressIndicatorProps) => {
  const danceSubmitted = submittedDances.has(activeDance);

  return (
    <div
      className="mb-2 rounded-lg overflow-hidden"
      style={{ border: `2px solid ${danceSubmitted ? '#48bb78' : '#667eea'}` }}
    >
      <div
        className="px-3 py-1.5 text-center"
        style={{ background: danceSubmitted ? '#48bb78' : '#667eea' }}
      >
        <p className="m-0 font-bold text-lg text-white">
          {danceSubmitted ? '✓ ' : ''}{activeDance}
        </p>
        <p className="m-0 text-[0.6875rem] text-white/85 font-medium">
          {danceSubmitted ? 'Submitted — waiting for next dance' : `Now Scoring — Dance ${currentDanceIndex + 1} of ${allDances.length}`}
        </p>
      </div>

      {allDances.length > 1 && (
        <div
          className="flex items-center justify-center gap-1 px-2 py-[0.3125rem]"
          style={{ background: danceSubmitted ? '#f0fff4' : '#eef2ff' }}
        >
          {allDances.map((d, i) => {
            const isThisDance = d === activeDance;
            const isSubmitted = submittedDances.has(d);
            return (
              <div key={d} className="flex items-center gap-1">
                <div
                  className="flex items-center justify-center text-[0.6875rem] font-bold text-white"
                  style={{
                    minWidth: isThisDance ? undefined : '8px',
                    height: isThisDance ? '22px' : '8px',
                    padding: isThisDance ? '0 0.5rem' : 0,
                    borderRadius: isThisDance ? '11px' : '50%',
                    background: isSubmitted ? '#48bb78' : isThisDance ? '#667eea' : '#cbd5e0',
                  }}
                >
                  {isThisDance ? d : ''}
                </div>
                {i < allDances.length - 1 && (
                  <div
                    className="w-3 h-0.5"
                    style={{ background: isSubmitted ? '#48bb78' : '#cbd5e0' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DanceProgressIndicator;
