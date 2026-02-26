import { Judge } from '../../../../types';

const JudgeBadge = ({ judge }: { judge: Judge }) => (
  <span className={`inline-flex items-center gap-2 py-1.5 px-3 bg-gray-100 rounded-md text-[0.9375rem] font-medium ${
    judge.isChairman ? 'border-2 border-yellow-500' : ''
  }`}>
    <span className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[0.8125rem] ${
      judge.isChairman ? 'bg-yellow-500' : 'bg-primary-500'
    }`}>
      {judge.judgeNumber}
    </span>
    {judge.name}{judge.isChairman ? ' \u2605' : ''}
  </span>
);

export default JudgeBadge;
