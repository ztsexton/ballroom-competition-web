import { Judge } from '../../../../types';

interface ScoringHeaderProps {
  judge: Judge;
  heatNumber: number;
  totalHeats: number;
  isFullscreen: boolean;
  onChangeJudge: () => void;
  onToggleFullscreen: () => void;
}

const ScoringHeader = ({ judge, heatNumber, totalHeats, isFullscreen, onChangeJudge, onToggleFullscreen }: ScoringHeaderProps) => (
  <div className="flex items-center justify-between px-2.5 py-1 bg-primary-500 rounded-lg mb-1.5 text-white">
    <div className="flex items-center gap-2">
      <span className="font-bold text-sm">
        J{judge.judgeNumber} {judge.name}
      </span>
      <button
        onClick={onChangeJudge}
        className="bg-transparent border-none text-white/60 text-[0.6875rem] cursor-pointer p-0 underline touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
      >
        change
      </button>
    </div>
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-white/80">
        Heat {heatNumber}/{totalHeats}
      </span>
      <button
        onClick={onToggleFullscreen}
        className="bg-transparent border-none text-white/70 text-xs cursor-pointer p-0 touch-manipulation leading-none select-none [-webkit-tap-highlight-color:transparent]"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? '⊗' : '⛶'}
      </button>
    </div>
  </div>
);

export default ScoringHeader;
