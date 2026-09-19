"use client";
// One motion system for the whole site.
//  - useReducedMotion / useFinePointer: environment gates every effect must respect.
//  - useScrollProgress: writes a unitless 0..1 CSS variable (--p) that CSS turns into motion.
//  - usePointerDepth: writes small -1..1 variables (--mx / --my) for restrained cursor depth.
// Both write CSS variables directly (no React re-render per frame) and share one scroll listener.
import { useEffect, useSyncExternalStore, type RefObject } from "react";

export const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

function subscribeMedia(query: string) {
  return (listener: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  };
}
const mediaSnapshot = (query: string) => () => window.matchMedia(query).matches;

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = subscribeMedia(reducedQuery);
const reducedSnapshot = mediaSnapshot(reducedQuery);
/** True when the visitor asked for reduced motion. Server render assumes motion is allowed. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, reducedSnapshot, () => false);
}

const fineQuery = "(hover: hover) and (pointer: fine)";
const subscribeFine = subscribeMedia(fineQuery);
const fineSnapshot = mediaSnapshot(fineQuery);
/** True for mouse/trackpad devices. Touch devices never get pointer-driven effects. */
export function useFinePointer() {
  return useSyncExternalStore(subscribeFine, fineSnapshot, () => false);
}

type Mode = "pass" | "sticky" | "page" | "center";
type Entry = { element: HTMLElement; mode: Mode };
const entries = new Set<Entry>();
let frame = 0;
let listening = false;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function progress({ element, mode }: Entry) {
  const viewport = window.innerHeight;
  if (mode === "page") {
    const scrollable = document.documentElement.scrollHeight - viewport;
    return scrollable > 0 ? clamp(window.scrollY / scrollable) : 0;
  }
  const rect = element.getBoundingClientRect();
  if (mode === "sticky") {
    // 0 when the section reaches the top of the screen, 1 when its end reaches the bottom.
    const range = rect.height - viewport;
    return range > 0 ? clamp(-rect.top / range) : rect.top < 0 ? 1 : 0;
  }
  if (mode === "center") {
    // 0 when the element's top reaches mid-screen, 1 when its bottom does.
    return clamp((viewport * 0.5 - rect.top) / rect.height);
  }
  // 0 as the section enters at the bottom, 1 as it leaves at the top.
  return clamp((viewport - rect.top) / (rect.height + viewport));
}

function run() {
  frame = 0;
  entries.forEach((entry) => {
    const value = progress(entry);
    const previous = entry.element.dataset.pv;
    const text = value.toFixed(4);
    if (previous !== text) {
      entry.element.dataset.pv = text;
      entry.element.style.setProperty("--p", text);
    }
  });
}
const schedule = () => {
  if (!frame) frame = requestAnimationFrame(run);
};

function register(entry: Entry) {
  entries.add(entry);
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  schedule();
  return () => {
    entries.delete(entry);
    entry.element.style.removeProperty("--p");
    delete entry.element.dataset.pv;
    if (!entries.size && listening) {
      listening = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    }
  };
}

/** Drives `--p` (0..1) on the element from the page scroll position. Reduced motion pins it to 1. */
export function useScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  mode: Mode = "pass",
) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (reduced) {
      element.style.setProperty("--p", "1");
      return () => element.style.removeProperty("--p");
    }
    return register({ element, mode });
  }, [ref, mode, reduced]);
}

/**
 * Small, eased pointer-relative depth. Writes --mx/--my (-1..1) on the element while the pointer
 * is over `area` (defaults to the element). No effect on touch devices or with reduced motion.
 */
export function usePointerDepth<T extends HTMLElement>(
  ref: RefObject<T | null>,
  area?: RefObject<HTMLElement | null>,
) {
  const reduced = useReducedMotion();
  const fine = useFinePointer();
  useEffect(() => {
    const element = ref.current;
    const surface = area?.current ?? element;
    if (!element || !surface || reduced || !fine) return;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let raf = 0;
    const tick = () => {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      element.style.setProperty("--mx", x.toFixed(3));
      element.style.setProperty("--my", y.toFixed(3));
      raf =
        Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002
          ? requestAnimationFrame(tick)
          : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      kick();
    };
    const leave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };
    surface.addEventListener("pointermove", move, { passive: true });
    surface.addEventListener("pointerleave", leave);
    return () => {
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", leave);
      if (raf) cancelAnimationFrame(raf);
      element.style.removeProperty("--mx");
      element.style.removeProperty("--my");
    };
  }, [ref, area, reduced, fine]);
}

/** True while the element is on screen and the tab is visible (used to pause loops). */
export function useInView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onChange: (visible: boolean) => void,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let inView = false;
    let tabVisible = document.visibilityState === "visible";
    const emit = () => onChange(inView && tabVisible);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        emit();
      },
      { threshold: 0.15 },
    );
    const visibility = () => {
      tabVisible = document.visibilityState === "visible";
      emit();
    };
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ref, onChange]);
}
