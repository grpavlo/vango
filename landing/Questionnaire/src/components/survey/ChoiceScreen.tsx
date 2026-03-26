import { useState } from "react";
import type { ChoiceNode, SurveyAnswer } from "@/data/surveyData";
import OptionButton from "./OptionButton";
import { ChevronLeft } from "lucide-react";

interface ChoiceScreenProps {
  node: ChoiceNode;
  nodeId: string;
  saved?: SurveyAnswer;
  onSelect: (answer: SurveyAnswer) => void;
  onNext: () => void;
  onBack: () => void;
}

const ChoiceScreen = ({ node, saved, onSelect, onNext, onBack }: ChoiceScreenProps) => {
  const [feedback, setFeedback] = useState(saved?.feedback || "");

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-muted-foreground text-sm mb-4 hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} />
        Назад
      </button>

      <h2 className="font-display text-2xl md:text-3xl leading-tight mb-5">
        {node.question}
      </h2>

      <div className="grid gap-3">
        {node.options.map((opt, idx) => (
          <OptionButton
            key={idx}
            label={opt.label}
            selected={saved?.value === opt.value}
            hasSelection={!!saved}
            onClick={() => {
              const answer: SurveyAnswer = {
                question: node.question,
                label: opt.label,
                value: opt.value,
                feedback: opt.feedback,
                next: opt.next,
              };
              onSelect(answer);
              setFeedback(opt.feedback);
            }}
          />
        ))}
      </div>

      {feedback && (
        <div className="mt-4 relative overflow-hidden rounded-2xl animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 animate-[shimmer_2s_ease-in-out_infinite]" />
          <div className="absolute inset-0 rounded-2xl border border-primary/30 shadow-[0_0_15px_hsl(48_100%_50%/0.15)]" />
          <div className="relative p-4 text-foreground text-sm leading-relaxed font-medium">
            <span className="inline-block text-primary mr-2">💡</span>
            {feedback}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!saved}
        className="w-full mt-6 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 transition-all"
      >
        Далі
      </button>
    </div>
  );
};

export default ChoiceScreen;
