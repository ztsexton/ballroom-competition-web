import { Judge } from '../../../../types';

const JudgeBadge = ({ judge }: { judge: Judge }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    background: '#edf2f7',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontWeight: 500,
    border: judge.isChairman ? '2px solid #d69e2e' : undefined,
  }}>
    <span style={{
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: judge.isChairman ? '#d69e2e' : '#667eea',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '0.8125rem',
    }}>
      {judge.judgeNumber}
    </span>
    {judge.name}{judge.isChairman ? ' \u2605' : ''}
  </span>
);

export default JudgeBadge;
