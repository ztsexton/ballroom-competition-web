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
    <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-1.5">
      {options.map(opt => {
        const isActive = opt.key === selectedMethod;
        return (
          <button
            key={opt.key}
            onClick={() => onMethodChange(opt.key)}
            className={`flex-1 py-1 px-1 min-h-[30px] border-none text-xs cursor-pointer transition-all touch-manipulation [-webkit-tap-highlight-color:transparent] ${
              isActive
                ? 'bg-primary-500 text-white font-bold'
                : 'bg-transparent text-gray-600 font-medium'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default InputMethodToggle;
