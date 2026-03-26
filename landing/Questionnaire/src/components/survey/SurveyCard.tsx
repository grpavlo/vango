import { useCallback, useState } from "react";
import logo from "@/assets/logo-vango.png";
import { surveyData, type SurveyAnswer } from "@/data/surveyData";
import { ApiError, submitSurvey } from "@/lib/api";
import ProgressBar from "./ProgressBar";
import IntroScreen from "./IntroScreen";
import ChoiceScreen from "./ChoiceScreen";
import TextScreen from "./TextScreen";
import EndScreen from "./EndScreen";

const SurveyCard = () => {
  const [currentNodeId, setCurrentNodeId] = useState(surveyData.start);
  const [history, setHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const node = surveyData.nodes[currentNodeId];

  const questionIndex =
    history.filter((id) => {
      const historyNode = surveyData.nodes[id];
      return historyNode && (historyNode.type === "choice" || historyNode.type === "text");
    }).length + (node.type === "choice" || node.type === "text" ? 1 : 0);

  const getQuestionFlowLength = useCallback(() => {
    let count = 0;
    let cursor: string | null = surveyData.start;
    const visited = new Set<string>();

    while (cursor && surveyData.nodes[cursor] && !visited.has(cursor)) {
      visited.add(cursor);
      const current = surveyData.nodes[cursor];
      if (current.type === "choice" || current.type === "text") {
        count++;
      }

      if (current.type === "intro") {
        cursor = current.next;
      } else if (current.type === "choice") {
        cursor = answers[cursor]?.next || null;
      } else if (current.type === "text") {
        cursor = current.next;
      } else {
        cursor = null;
      }
    }

    return Math.max(count, questionIndex);
  }, [answers, questionIndex]);

  const goTo = (nodeId: string) => {
    setHistory((prev) => [...prev, currentNodeId]);
    setCurrentNodeId(nodeId);
  };

  const goBack = () => {
    if (!history.length || isSubmittingFinal) {
      return;
    }

    const prev = [...history];
    const last = prev.pop()!;
    setHistory(prev);
    setCurrentNodeId(last);
    setSubmitError(null);
  };

  const restart = () => {
    setCurrentNodeId(surveyData.start);
    setHistory([]);
    setAnswers({});
    setIsSubmittingFinal(false);
    setSubmitError(null);
  };

  const submitFinalAnswers = async (nextAnswers: Record<string, SurveyAnswer>): Promise<boolean> => {
    const normalizedAnswers = Object.entries(nextAnswers).map(([nodeId, answer]) => ({
      nodeId,
      question: answer.question || "",
      label: answer.label || "",
      value: answer.value || "",
    }));

    const name = (nextAnswers.q_name_input?.value || "").trim();
    const contact = (nextAnswers.q_contact_input?.value || "").trim();

    if (!name || !contact) {
      setSubmitError("Заповніть ім'я та контакт.");
      return false;
    }

    try {
      setIsSubmittingFinal(true);
      setSubmitError(null);
      await submitSurvey({
        name,
        contact,
        answers: normalizedAnswers,
      });
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Не вдалося зберегти відповідь. Спробуйте ще раз.");
      }
      return false;
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  if (!node) {
    return null;
  }

  const totalSteps = getQuestionFlowLength();

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="VanGo" className="h-14" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
        {node.type !== "intro" && node.type !== "end" && (
          <ProgressBar current={questionIndex} total={totalSteps} />
        )}

        {node.type === "intro" && <IntroScreen node={node} onNext={() => goTo(node.next)} />}

        {node.type === "choice" && (
          <ChoiceScreen
            key={currentNodeId}
            node={node}
            nodeId={currentNodeId}
            saved={answers[currentNodeId]}
            onSelect={(answer) => {
              setAnswers((prev) => ({ ...prev, [currentNodeId]: answer }));
              setSubmitError(null);
            }}
            onNext={() => {
              const selectedAnswer = answers[currentNodeId];
              if (selectedAnswer?.next) {
                goTo(selectedAnswer.next);
              }
            }}
            onBack={goBack}
          />
        )}

        {node.type === "text" && (
          <TextScreen
            key={currentNodeId}
            node={node}
            nodeId={currentNodeId}
            saved={answers[currentNodeId]}
            isSubmitting={isSubmittingFinal}
            submitError={submitError}
            onSubmit={async (answer) => {
              const nextAnswers = { ...answers, [currentNodeId]: answer };
              setAnswers(nextAnswers);
              setSubmitError(null);

              const nextNodeId = answer.next;
              if (!nextNodeId) {
                return;
              }

              const nextNode = surveyData.nodes[nextNodeId];
              if (nextNode?.type === "end") {
                const submitted = await submitFinalAnswers(nextAnswers);
                if (submitted) {
                  goTo(nextNodeId);
                }
                return;
              }

              goTo(nextNodeId);
            }}
            onBack={goBack}
          />
        )}

        {node.type === "end" && <EndScreen node={node} onRestart={restart} />}
      </div>
    </div>
  );
};

export default SurveyCard;
