"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconMonitor, IconMoon, IconSun } from "./icons";
import { motion, MotionConfig, animate, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";

export const spring = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;

export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/console", label: "Seller" },
  { href: "/shop", label: "Buyer agent" },
];

export function Nav() {
  const path = usePathname();
  return (
    <div className="nav-wrap">
      <motion.nav
        className="nav"
        initial={{ y: -24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease }}
      >
        <Link href="/" className="brand" aria-label="DisputeShield home">
          <span className="brand-mark"><ShieldIcon /></span>
          <span className="brand-text">DisputeShield</span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`nav-link${active ? " active" : ""}${l.href === "/" ? " home" : ""}`}>
                {active && <motion.span layoutId="nav-pill" className="pill-bg" transition={spring} />}
                {l.label}
              </Link>
            );
          })}
        </div>
        <span className="env">Sandbox</span>
        <ThemeSwitch />
      </motion.nav>
    </div>
  );
}

// ───────── theme ─────────
// The choice lives on <html data-theme> (set before paint by THEME_SCRIPT in layout) and in localStorage.

export type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "ds-theme";
const THEME_EVENT = "ds-themechange";

function readTheme(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  root.classList.add("theme-anim");
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: the choice still applies for this visit */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
  window.setTimeout(() => root.classList.remove("theme-anim"), 500);
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <IconSun size={15} /> },
  { value: "dark", label: "Dark", icon: <IconMoon size={15} /> },
  { value: "system", label: "Match system", icon: <IconMonitor size={15} /> },
];

export function ThemeSwitch() {
  const choice = useSyncExternalStore<ThemeChoice>(subscribeTheme, readTheme, () => "system");
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => applyTheme(o.value)}
        >
          {choice === o.value && <motion.span layoutId="theme-knob" className="knob" transition={spring} />}
          {o.icon}
        </button>
      ))}
    </div>
  );
}

export function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2.5 4 5.6v6.1c0 4.9 3.4 8.6 8 9.8 4.6-1.2 8-4.9 8-9.8V5.6l-8-3.1Z" fill="currentColor" opacity=".25" />
      <path d="M12 2.5 4 5.6v6.1c0 4.9 3.4 8.6 8 9.8 4.6-1.2 8-4.9 8-9.8V5.6l-8-3.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m8.6 12.2 2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fades and rises into place when it scrolls into view. */
export function Reveal({ children, delay = 0, y = 16, ...rest }: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.8, ease, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggers its direct <Item> children. */
export function Stagger({ children, className, gap = 0.06 }: { children: ReactNode; className?: string; gap?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.985 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Animated number. */
export function CountUp({ value, format = (n) => Math.round(n).toString() }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const [text, setText] = useState(format(0));
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      const t = setTimeout(() => setText(format(value)), 0);
      prev.current = value;
      return () => clearTimeout(t);
    }
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease,
      onUpdate: (n) => setText(format(n)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, format, reduce]);
  return <span ref={ref} className="mono">{text}</span>;
}

export function Badge({ tone = "neutral", dot, children }: { tone?: "good" | "warn" | "bad" | "info" | "neutral"; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge b-${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Typing() {
  return <span className="typing" aria-label="Working"><i /><i /><i /></span>;
}
