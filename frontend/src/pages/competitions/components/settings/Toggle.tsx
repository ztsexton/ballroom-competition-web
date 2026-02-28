interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

const Toggle = ({ value, onChange, label }: ToggleProps) => (
  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${value ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full border-none cursor-pointer relative transition-colors shrink-0 ${value ? 'bg-success-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
    <span className="text-sm font-medium text-gray-600">{label}</span>
  </div>
);

export default Toggle;
