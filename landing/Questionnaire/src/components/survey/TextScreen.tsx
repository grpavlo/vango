import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { TextNode, SurveyAnswer } from "@/data/surveyData";

interface TextScreenProps {
  node: TextNode;
  nodeId: string;
  saved?: SurveyAnswer;
  onSubmit: (answer: SurveyAnswer) => void;
  onBack: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

const TextScreen = ({
  node,
  nodeId,
  saved,
  onSubmit,
  onBack,
  isSubmitting = false,
  submitError = null,
}: TextScreenProps) => {
  const [value, setValue] = useState(saved?.value || "");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(true);
      return;
    }

    setError(false);
    onSubmit({
      question: node.question,
      label: trimmed,
      value: trimmed,
      next: node.next,
    });
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Назад
      </button>

      <h2 className="mb-5 font-display text-2xl leading-tight md:text-3xl">
        {node.question}
      </h2>

      <input
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(false);
        }}
        placeholder={node.placeholder}
        className="w-full rounded-2xl border border-border bg-card-interactive px-4 py-4 text-base text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
      />

      {node.hint && <p className="mt-2 text-sm text-muted-foreground">{node.hint}</p>}

      {error && (
        <p className="mt-2 text-sm text-destructive">Будь ласка, заповніть поле.</p>
      )}

      {submitError && <p className="mt-2 text-sm text-destructive">{submitError}</p>}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="mt-6 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Збереження..." : "Завершити"}
      </button>
    </div>
  );
};

export default TextScreen;
