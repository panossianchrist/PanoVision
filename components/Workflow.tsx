import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";
export function Workflow({ detailed = false }: { detailed?: boolean }) {
  const t = useTranslations("workflow");
  return (
    <ol className={`workflow ${detailed ? "workflow-detailed" : ""}`}>
      {["Explore", "Build", "Upload", "Preview", "Review", "Quote", "Live", "Verify"].map((step, index) => (
        <li key={step}><Reveal className="workflow-step">
          <span className="step-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{t(step)}</h3>
          <p>{t(`${step}Text`)}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
