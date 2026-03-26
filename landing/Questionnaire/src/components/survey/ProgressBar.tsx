interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar = ({ current, total }: ProgressBarProps) => {
  const percent = Math.max(8, Math.round((current / total) * 100));

  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-2 font-body">
        <span>Крок {current}</span>
        <span>{current} / {total}</span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
