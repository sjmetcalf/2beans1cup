import { useEffect, useRef, useState } from "react";
import { useHashRoute, useBaristaCode } from "./hooks.js";
import { Grain } from "./bits.jsx";
import { Home } from "./pages/Home.jsx";
import { PourLog } from "./pages/PourLog.jsx";
import { SideBySide } from "./pages/SideBySide.jsx";
import { Menu } from "./pages/Menu.jsx";
import { Bar } from "./pages/Bar.jsx";
import { Barista } from "./pages/Barista.jsx";
import { FreeTime } from "./pages/FreeTime.jsx";
import { Drift } from "./pages/Drift.jsx";

const NAV = [
  { to: "/", label: "Cafe", short: "Cafe" },
  { to: "/menu", label: "The Menu", short: "Menu" },
  { to: "/pour-log", label: "Pour Log", short: "Log" },
  { to: "/side-by-side", label: "Side by Side", short: "Compare" },
  { to: "/bar", label: "Bar Station", short: "Bar" },
];
const PRIVATE_NAV = [{ to: "/free-time", label: "Free Time", short: "Free" }];

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="10" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6.4 18.3c1.3-2.3 3.2-3.4 5.6-3.4s4.3 1.1 5.6 3.4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const PAGES = {
  "/": Home,
  "/menu": Menu,
  "/pour-log": PourLog,
  "/side-by-side": SideBySide,
  "/bar": Bar,
  "/barista": Barista,
  "/free-time": FreeTime,
  "/drift": Drift,
};

function Nav({ route }) {
  const listRef = useRef(null);
  const headerRef = useRef(null);
  // Expose the header height so sticky table headers sit right under it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--nav-h", `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(set) : null;
    ro?.observe(el);
    window.addEventListener("resize", set);
    return () => { ro?.disconnect(); window.removeEventListener("resize", set); };
  }, []);
  const [pill, setPill] = useState(null);
  const code = useBaristaCode();
  const items = [...NAV, ...(code ? PRIVATE_NAV : [])];

  useEffect(() => {
    const list = listRef.current;
    const place = () => {
      const el = list?.querySelector(`[data-to="${route}"]`);
      if (!el) return setPill(null);
      if (!el.offsetWidth) return setPill(null);
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready?.then(place);
    return () => window.removeEventListener("resize", place);
  }, [route, code]);

  return (
    <header className="nav" ref={headerRef}>
      <a href="#/" className="nav-brand" aria-label="Doppio Drifters home">
        <span className="wordmark">Doppio <span className="wordmark-1">Drifters</span></span>
      </a>
      <a href="#/barista" className={`nav-account ${route === "/barista" ? "is-active" : ""}`} aria-label={code ? "Barista settings (you're behind the bar)" : "Barista settings"}>
        <PersonIcon />
        {code && <span className="nav-account-dot" aria-hidden="true" />}
      </a>
      <div className="nav-scroller">
        <nav className="nav-links" ref={listRef} aria-label="Sections">
          {pill && <span className="nav-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />}
          {items.map((n) => (
            <a key={n.to} href={`#${n.to}`} data-to={n.to} className={route === n.to ? "is-active" : ""} aria-current={route === n.to ? "page" : undefined}>
              <span className="nav-label-long">{n.label}</span>
              <span className="nav-label-short">{n.short}</span>
            </a>
          ))}
          <a href="#/barista" data-to="/barista" className={`nav-barista ${route === "/barista" ? "is-active" : ""}`} aria-current={route === "/barista" ? "page" : undefined}>
            <span className={`dot ${code ? "dot-on" : ""}`} aria-hidden="true" />
            Barista
          </a>
        </nav>
      </div>
    </header>
  );
}

export function App() {
  const [route] = useHashRoute();
  const Page = PAGES[route] || Home;
  return (
    <>
      <Grain />
      <Nav route={route} />
      <main className="page" key={route}>
        <Page />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <p className="muted footer-meta">Ski · Run · Bike · <a href="#/drift" className="footer-play">Play <span className="hide-narrow">Doppio </span>Drift</a></p>
        </div>
      </footer>
    </>
  );
}
