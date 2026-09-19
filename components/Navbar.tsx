"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { company } from "@/lib/company";
import { useTranslations } from "next-intl";
import { LanguageSelect } from "./LanguageSelect";

const links = [
  ["/network", "network"],
  ["/how-it-works", "how"],
  ["/#special-occasions", "special"],
  ["/#about", "about"],
  ["/contact", "contact"],
];

export function Navbar({signedIn=false}:{signedIn?:boolean}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = () => {
      setOpen(false);
      toggle.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "Tab") {
        const items = [
          toggle.current,
          ...Array.from(
            panel.current?.querySelectorAll<HTMLElement>("a,button,select") || [],
          ),
        ].filter(Boolean) as HTMLElement[];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const media = window.matchMedia("(min-width: 1101px)");
    const onResize = () => {
      if (media.matches) close();
    };
    media.addEventListener("change", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prior;
      document.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          className="brand"
          href="/"
          aria-label="PanoVision home"
          onClick={() => setOpen(false)}
        >
          <Image
            src={company.logo}
            alt="PanoVision. Where brands get seen."
            width={1000}
            height={180}
            priority
          />
        </Link>
        <button
          className="icon-button menu-toggle"
          ref={toggle}
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          className={`primary-nav ${open ? "is-open" : ""}`}
          id="primary-nav"
          ref={panel}
          aria-label={t("nav")}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {t(label)}
            </Link>
          ))}
          <Link className="account-nav-link" href={signedIn?"/dashboard":"/login"} onClick={() => setOpen(false)}>{t(signedIn?"dashboard":"login")}</Link>
          <LanguageSelect />
          <Link
            className="button button-small"
            href="/start-campaign"
            onClick={() => setOpen(false)}
          >
            {t("start")} <ArrowUpRight size={16} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
