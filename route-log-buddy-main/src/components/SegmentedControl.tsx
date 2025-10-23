interface SegmentedControlProps {
  options: string[];
  activeOption: string;
  onOptionChange: (option: string) => void;
}

const SegmentedControl = ({ options, activeOption, onOptionChange }: SegmentedControlProps) => {
  return (
    <div className="flex bg-secondary rounded-lg p-1 mb-base">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onOptionChange(option)}
          className={`flex-1 py-2 px-4 rounded-md text-mobile-label font-medium transition-all duration-200 ${
            activeOption === option
              ? 'bg-primary text-primary-foreground'
              : 'text-text-subtitle'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

export default SegmentedControl;