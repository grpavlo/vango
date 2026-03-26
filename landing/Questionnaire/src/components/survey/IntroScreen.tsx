import type { IntroNode } from "@/data/surveyData";

interface IntroScreenProps {
  node: IntroNode;
  onNext: () => void;
}

const IntroScreen = ({ node, onNext }: IntroScreenProps) => (
  <div className="animate-fade-in">
    <h1 className="font-display text-3xl md:text-4xl leading-tight mb-4">
      {node.title}
    </h1>
    <p className="text-muted-foreground text-base leading-relaxed mb-8">
      {node.text}
    </p>
    <button
      onClick={onNext}
      className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:-translate-y-0.5 transition-transform"
    >
      Почати
    </button>
  </div>
);

export default IntroScreen;
