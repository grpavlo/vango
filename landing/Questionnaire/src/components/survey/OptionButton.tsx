import { cn } from "@/lib/utils";

interface OptionButtonProps {
  label: string;
  selected: boolean;
  hasSelection: boolean;
  onClick: () => void;
}

const OptionButton = ({ label, selected, hasSelection, onClick }: OptionButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left rounded-2xl border px-5 py-4 text-base leading-relaxed transition-all duration-200",
      selected
        ? "border-primary/80 bg-primary/10 text-foreground"
        : "border-border bg-card-interactive text-foreground hover:-translate-y-0.5",
      hasSelection && !selected && "opacity-30"
    )}
  >
    {label}
  </button>
);

export default OptionButton;
