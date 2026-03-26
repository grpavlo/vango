import type { EndNode } from "@/data/surveyData";

interface EndScreenProps {
  node: EndNode;
  onRestart: () => void;
}

const EndScreen = ({ node, onRestart }: EndScreenProps) => (
  <div className="animate-fade-in">
    <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3">
      {node.title}
    </h2>
    <p className="text-muted-foreground text-base leading-relaxed mb-6">
      {node.text}
    </p>

    <button
      onClick={onRestart}
      className="w-full py-4 rounded-2xl border border-border text-foreground font-semibold text-base hover:-translate-y-0.5 transition-transform"
    >
      Пройти ще раз
    </button>
  </div>
);

export default EndScreen;
