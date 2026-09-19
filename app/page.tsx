import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Eye,
  MapPin,
  SlidersHorizontal,
  Network,
  ArrowRight,
  MonitorUp,
} from "lucide-react";
import { HeroDisplay } from "@/components/HeroDisplay";
import { SpecialOccasions } from "@/components/SpecialOccasions";
import { useTranslations } from "next-intl";
import { NetworkSection } from "@/components/NetworkSection";
import { Workflow } from "@/components/Workflow";
import { CampaignCTA } from "@/components/CampaignCTA";
import { Reveal } from "@/components/Reveal";
import { company } from "@/lib/company";

const advantages = [
  {
    icon: Eye,
    title: "High visibility",
    text: "Elevated displays designed for a strong visual presence from surrounding roads.",
  },
  {
    icon: MapPin,
    title: "Strategic placement",
    text: "Screen locations planned around prominent roadside environments.",
  },
  {
    icon: SlidersHorizontal,
    title: "Digital campaign management",
    text: "Locations, dates and creative submissions in one considered workflow.",
  },
  {
    icon: Network,
    title: "Built to scale",
    text: "From a pilot display to a connected, multi-location media network.",
  },
];

export default function Home() {
  const t = useTranslations("home"),
    common = useTranslations("common"),
    comparison = useTranslations("comparison"),
    workflow = useTranslations("workflow");
  return (
    <>
      <section className="hero">
        <HeroDisplay />
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> {t("building")}
            </p>
            <h1>
              {t("hero1")}
              <br />
              <span>{t("hero2")}</span>
            </h1>
            <p className="hero-description">{t("description")}</p>
            <p className="hero-detail">{t("detail")}</p>
            <div className="actions">
              <Link className="button" href="/start-campaign">
                {common("start")} <ArrowUpRight size={19} />
              </Link>
              <a className="text-link" href="#network">
                {t("explore")} <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
          <div className="hero-bottom">
            <span className="micro">{t("infrastructure")}</span>
            <a
              href="#introduction"
              className="scroll-cue"
              aria-label={common("about")}
            >
              <ArrowDown size={17} />
            </a>
            <span className="micro">{t("pilot")}</span>
          </div>
        </div>
      </section>
      <section className="introduction section-space" id="introduction">
        <div className="container">
          <Reveal className="intro-layout">
            <div>
              <span className="section-index">{t("perspective")}</span>
              <h2>{t("road")}</h2>
            </div>
            <div className="intro-copy">
              <p className="lead">{t("different")}</p>
              <p>{t("intro")}</p>
              <div className="three-lines">
                <span>
                  <MonitorUp size={17} /> {t("elevated")}
                </span>
                <span>
                  <MapPin size={17} /> {t("placement")}
                </span>
                <span>
                  <ArrowRight size={17} /> {t("digitalProcess")}
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="section-space network-section" id="network">
        <div className="container">
          <Reveal className="section-heading">
            <div>
              <span className="section-index">{t("networkIndex")}</span>
              <h2>{t("reach")}</h2>
            </div>
            <p>{t("reachText")}</p>
          </Reveal>
          <NetworkSection />
        </div>
      </section>
      <section className="screen-section section-space">
        <div className="container">
          <Reveal className="section-heading">
            <div>
              <span className="section-index">{t("screenIndex")}</span>
              <h2>{t("screenTitle")}</h2>
            </div>
            <p>{t("screenText")}</p>
          </Reveal>
          <Reveal>
            <figure className="concept-figure">
              <Image
                src={company.conceptImage}
                alt={t("conceptAlt")}
                width={1536}
                height={1024}
                sizes="(max-width: 720px) 100vw, 90vw"
              />
              <span className="concept-label">{t("concept")}</span>
              <figcaption>
                <span>{t("visibility")}</span>
                <span>{t("conceptNote")}</span>
              </figcaption>
            </figure>
          </Reveal>
          <div className="screen-caption">
            <p>{t("screenCaption")}</p>
            <span className="micro">{t("infrastructure")}</span>
          </div>
        </div>
      </section>
      <SpecialOccasions />
      <section className="advantages section-space">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-index">{t("why")}</span>
              <h2>{t("whyTitle")}</h2>
            </div>
            <p>{t("whyText")}</p>
          </div>
          <div className="advantage-grid">
            {advantages.map((item, index) => (
              <Reveal key={item.title}>
                <article className="advantage">
                  <div className="advantage-top">
                    <item.icon size={24} />
                    <span className="micro muted">0{index + 1}</span>
                  </div>
                  <h3>{t(`advantage${index + 1}`)}</h3>
                  <p>{t(`advantageText${index + 1}`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="workflow-section section-space">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-index">{t("workflowIndex")}</span>
              <h2>{t("workflowTitle")}</h2>
            </div>
            <Link className="text-link" href="/how-it-works">
              {t("fullProcess")} <ArrowUpRight size={18} />
            </Link>
          </div>
          <Workflow />
          <div className="format-bar">
            <span>
              <strong>08</strong> {t("format")}
            </span>
            <p>{t("specs")}</p>
            <span className="micro">{t("approval")}</span>
          </div>
        </div>
      </section>
      <section className="digital-section section-space">
        <div className="container digital-layout">
          <div>
            <span className="section-index">{t("connectedIndex")}</span>
            <h2>{t("connectedTitle")}</h2>
            <p>{t("connectedText")}</p>
          </div>
          <div className="process-comparison">
            <div className="process-row traditional">
              <span className="micro muted">{comparison("before")}</span>
              <div>
                <p>{comparison("beforeText")}</p>
              </div>
            </div>
            <div className="process-row connected">
              <span className="micro blue">{comparison("after")}</span>
              <ol>
                {["Explore", "Upload", "Review", "Quote", "Verify"].map(
                  (step, index) => (
                    <li key={step}>
                      <span>0{index + 1}</span>
                      {workflow(step)}
                      {index < 4 && <ArrowDown size={15} />}
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>
        </div>
      </section>
      <section className="about-section section-space" id="about">
        <div className="container intro-layout">
          <div>
            <span className="section-index">{t("aboutIndex")}</span>
            <h2>{t("aboutTitle")}</h2>
          </div>
          <div className="intro-copy">
            <p className="lead">{t("rooted")}</p>
            <p>{t("aboutText")}</p>
            <p>{t("ambition")}</p>
            <Link className="text-link" href="/contact">
              {t("talk")} <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <CampaignCTA />
    </>
  );
}
