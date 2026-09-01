import { ReactNode } from "react";
import { VIcon } from "./v-icon";

type FactTone = "blue" | "green" | "orange" | "violet" | "teal" | "slate";

export function FactVisual({
  icon,
  label,
  value,
  tone = "green",
  wide = false,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  tone?: FactTone;
  wide?: boolean;
}) {
  return <article className={`fact-visual ${tone}${wide ? " wide" : ""}`}>
    <span className="fact-visual-icon"><VIcon name={icon} size={22}/></span>
    <div><span>{label}</span><strong>{value}</strong></div>
  </article>;
}
