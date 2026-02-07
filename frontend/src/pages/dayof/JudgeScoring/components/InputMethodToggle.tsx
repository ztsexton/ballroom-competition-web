import { InputMethod } from '../types';

const InputMethodToggle = ({
  mode,
  selectedMethod,
  onMethodChange,
}: {
  mode: 'ranking' | 'proficiency';
  selectedMethod: string;
  onMethodChange: (method: InputMethod) => void;
}) => {
  const options: { key: InputMethod; label: string }[] = mode === 'ranking'
    ? [{ key: 'tap', label: 'Tap' }, { key: 'picker', label: 'Picker' }, { key: 'keyboard', label: 'Keyboard' }]
    : [{ key: 'quickscore', label: 'Quick Score' }, { key: 'keyboard', label: 'Keyboard' }];

  return (
    <div style={{
      display: 'flex',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '0.5rem',
    }}>
      {options.map(opt => {
        const isActive = opt.key === selectedMethod;
        return (
          <button
            key={opt.key}
            onClick={() => onMethodChange(opt.key)}
            style={{
              flex: 1,
              padding: '0.375rem 0.25rem',
              minHeight: '34px',
              border: 'none',
              background: isActive ? '#667eea' : 'transparent',
              color: isActive ? 'white' : '#4a5568',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default InputMethodToggle;
