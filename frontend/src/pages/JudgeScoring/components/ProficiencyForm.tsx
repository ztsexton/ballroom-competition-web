import { CoupleInfo } from '../types';

const ProficiencyForm = ({
  couples,
  scores,
  onChange,
  isProAm,
}: {
  couples: CoupleInfo[];
  scores: Record<number, number>;
  onChange: (bib: number, value: string) => void;
  isProAm?: boolean;
}) => (
  <div>
    <p style={{ fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.875rem' }}>
      Score each couple (0-100):
    </p>
    {couples.map(couple => (
      <div
        key={couple.bib}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.625rem',
          marginBottom: '0.3125rem',
          borderRadius: '6px',
          border: `1px solid ${isProAm ? '#fcd34d' : '#e2e8f0'}`,
          borderLeft: isProAm ? '3px solid #f59e0b' : undefined,
          background: isProAm ? '#fffbeb' : '#fff',
          minHeight: '44px',
        }}
      >
        <strong style={{ fontSize: '1.0625rem', flex: 1 }}>#{couple.bib}</strong>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={scores[couple.bib] ?? ''}
          onChange={(e) => onChange(couple.bib, e.target.value)}
          style={{
            width: '56px',
            height: '40px',
            textAlign: 'center',
            padding: '0.125rem',
            border: '2px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '1.25rem',
            fontWeight: 700,
            touchAction: 'manipulation',
          }}
        />
      </div>
    ))}
  </div>
);

export default ProficiencyForm;
