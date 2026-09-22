import { useTranslations } from "next-intl";
import { Reveal } from "./Reveal";

/**
 * Why PanoVision as four large horizontal rows, not cards. Hover and keyboard focus grow the
 * rule, light the numeral and shift the description. Pure CSS, so it works with touch too.
 */
export function WhyRows() {
  const t = useTranslations("home");
  return (
    <ol className="pv-why-list">
      {[1, 2, 3, 4].map((n) => (
        <li key={n}>
          <Reveal className="pv-why-row-wrap">
            <div className="pv-why-row">
              <span className="pv-why-num" aria-hidden="true">
                0{n}
              </span>
              <h3>{t(`advantage${n}`)}</h3>
              <p>{t(`advantageText${n}`)}</p>
              <span className="pv-why-rule" aria-hidden="true" />
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
